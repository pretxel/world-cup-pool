## Context

`match_summaries` already holds an AI recap per version: `content` (the factual
text), plus `style_key`/`style_instruction`, `is_active`, and provider/token
metadata. Recaps are generated server-side in `lib/matches/match-summary.ts` via
`lib/ai/openrouter.ts` (`createChatCompletion`), which is OpenAI-compatible chat
only, returns `null` when `OPENROUTER_API_KEY` is unset, and throws on a real HTTP
failure. The auto flow (`generateMatchSummary` / `generatePendingSummaries`) runs in
the result-sync cron after matches go final; the admin detail page exposes per-version
regenerate/activate server actions.

We want a second, derived artifact: an image-generation prompt that turns a recap into
a 90s-anime, 4-panel comic strip. The user supplied a fixed template (ART STYLE,
CHARACTER DESIGN with recurring protagonist "Kenji", TECHNICAL SPECIFICATIONS) and a
PANEL LAYOUT & SCENE SEQUENCE skeleton to be filled per match. The rendered image is
explicitly future work; this change only enriches and stores the prompt.

## Goals / Non-Goals

**Goals:**
- Store one image-generation prompt per recap version (`image_prompt`, nullable).
- Reuse the existing OpenRouter chat client to enrich a recap's `content` into the
  comic template's panel sequence, keeping the fixed sections verbatim.
- Generate automatically alongside the active recap in the auto flow, isolated from
  recap/score writes, and on demand per version from the admin detail page.
- Stay dormant (no DB/network) when `OPENROUTER_API_KEY` is unset, mirroring recaps.

**Non-Goals:**
- Calling an image model to produce an actual image (separate future change).
- Localizing the prompt — like recaps today, it is generated in English.
- Versioning the template itself or an admin template editor; the template is a
  code constant for now.
- Backfilling `image_prompt` for historical recaps as part of this change (the auto
  flow only fills new recaps; admin action covers any one-off).

## Decisions

### New column vs. new table
Add `image_prompt text` (nullable) to `match_summaries` rather than a side table. The
prompt is 1:1 with a recap version, derived from its `content`, and shares its
lifecycle (cascade delete, active/draft visibility). A column keeps reads/writes on
the row we already touch. RLS needs no change: the existing `is_active` SELECT policy
already governs the whole row, so the active version's `image_prompt` is public and
drafts stay hidden. Alternative (separate `match_summary_images` table) buys nothing
until we store rendered images with their own metadata — defer to the image change.

### Template as code constants + pure builder
Put the fixed template text in `lib/matches/match-image-prompt.ts` as constants and
expose a pure `buildImagePromptMessages(content, match)` returning `{ system, user }`,
mirroring the testable `buildSummaryPrompt`. The system message instructs the model to
emit the three fixed sections verbatim and to write ONLY the four `Visual` /
`Narration Box` panels, grounded strictly in the supplied recap + match context. This
keeps the prompt shape unit-testable with no network call and the "no invented facts"
constraint consistent with recaps. Alternative (template in DB) is rejected as
premature — no admin-editing requirement exists yet.

### Reuse `createChatCompletion`; no image SDK
Enrichment is a text-to-text task, so it uses the existing chat client with the
default `env.openrouterModel`. We raise `maxTokens` for this call (the comic prompt is
longer than a recap; ~600-800) and keep temperature moderate. No new dependency, no
image model. The eventual render step will choose an image provider in its own change.

### `generateMatchImagePrompt(admin, summaryId)`
A single function loads the summary row (`content` + its match's teams/score/stage via
the `match_id`), builds the messages, calls OpenRouter, and updates `image_prompt` on
that `id`. It returns a small result (`{ generated, reason? }`) like the recap
generator: `no-key` when the key is unset, `missing` when the row/match is absent,
`empty-content` if `content` is blank. It throws only on a configured-key provider/DB
failure so callers decide how to react.

### Two triggers, one core
- **Auto:** in `generateMatchSummary`'s success path (auto mode, after the active
  recap is inserted), call `generateMatchImagePrompt(admin, inserted.id)` inside a
  try/catch that logs and swallows errors. This guarantees the image-prompt step can
  never fail the recap insert, score writes, or the sync pass. Only the auto
  (active-publishing) path chains it; the regenerate path stays opt-in via the admin
  button so drafts don't spend tokens automatically.
- **Admin:** a new server action `generateMatchImagePromptAction(summaryId)` in the
  admin matches `actions.ts`, guarded by the same admin check the other recap actions
  use, calling the core function and `revalidatePath` on the detail route. The detail
  page renders the stored `image_prompt` per version with a "Generate image prompt"
  button (regenerate when present).

### Migration + types
One forward-only SQL migration `..._match_summaries_image_prompt.sql` adding the
nullable column (no backfill, no policy change). Regenerate `lib/database.types.ts`.

## Risks / Trade-offs

- **Doubled LLM cost/latency in the auto flow** (a second call per final match) →
  Gate strictly behind the existing key check, run only on the active auto recap (not
  drafts), and isolate in try/catch so it is best-effort. Cost scales with finals/day,
  which is bounded; the batch limit on recaps already caps the burst.
- **Model drifts from the template** (omits fixed sections, wrong panel count) →
  Strong, explicit system instructions ("emit these sections verbatim", "exactly four
  panels"); a higher token cap so output isn't truncated mid-prompt. The prompt is a
  draft artifact reviewable/regenerable by an admin, so imperfect output is low-stakes.
- **Stale image prompt after a recap edit** → Out of scope: recap `content` is not
  edited in place today (new versions are inserted). If that changes, regeneration is
  one admin click. The auto chain always derives from freshly-inserted content.
- **Prompt leakage of unintended content** → The builder constrains the model to the
  supplied recap + match context only; public exposure is limited to the active
  version's `image_prompt` under the unchanged RLS policy.

## Migration Plan

1. Ship the SQL migration adding `match_summaries.image_prompt` (nullable) — additive,
   safe on a live table, no lock-heavy rewrite.
2. Regenerate and commit `lib/database.types.ts`.
3. Land `lib/matches/match-image-prompt.ts` + unit tests for `buildImagePromptMessages`
   (fixed sections present, four panels, grounding).
4. Chain the auto call in `generateMatchSummary`; add the admin action + detail-page UI
   and the i18n string.
5. Rollback: feature is dormant without `OPENROUTER_API_KEY`; the column is nullable
   and unread elsewhere, so reverting the code leaves a harmless unused column (or drop
   it in a follow-up migration).

## Open Questions

- Token cap for the enrichment call: start at ~800 and tune against real output length.
- Should the admin detail page offer a one-click copy of the stored prompt for manual
  use in an external image tool before the render step exists? (Low effort; can fold
  into the UI task.)
