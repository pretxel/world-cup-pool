# Design: admin fixture detail page with recap versioning & styled regeneration

## Context

`/admin/matches` (`app/[locale]/(admin)/admin/matches/page.tsx`) is a server-rendered list: per-row inline result entry, sync, resend-emails, summarize, and delete controls, with outcomes surfaced via query params + `ActionStatus`/`LiveRegion`. There is **no** `/admin/matches/[matchId]` route today.

Recaps live in `match_summaries` (migration `20260616000000_match_summaries.sql`): `UNIQUE (match_id)` (at-most-one), `content`, `provider`, `model`, token fields, `locale`, timestamps; RLS public-select-all, service-role writes. `generateMatchSummary(admin, matchId)` is idempotent — it returns `reason: "exists"` and skips when a row is present, with a hardcoded English system prompt in `buildSummaryPrompt`. No style-injection point and no way to produce a second recap.

Admin conventions to reuse: `AdminPageHeader`, `FormSection`, `SubmitButton` (pending + `confirmText`), `ActionStatus`, `LiveRegion`, back-link pattern (`competitions/[id]/page.tsx`), and public match components (`TeamFlag`, `MatchStateBadge`, `LocalTime`, `VenueImage`). Auth/scope fence: `assertAdmin()`, `getManagedCompetition()`, `assertMatchInManaged()`. i18n via `getTranslations("admin")` with en/es/fr parity (`tests/i18n.test.ts`).

## Goals / Non-Goals

**Goals**
- A focused admin fixture detail page reachable from the list.
- Multiple recap versions per match with exactly one active (published) version.
- Styled regeneration (presets + free-text) that produces draft versions.
- A deliberate publish step; public viewers only ever see the active version.

**Non-Goals**
- No per-locale recaps — recap body stays English (`locale = 'en'`); only the style varies.
- No change to the cron/sync auto-generation cadence or `recordRun` accounting; the manual regenerate path is not recorded as an operation run (consistent with the existing manual `summarizeMatch`).
- No bulk/multi-match regeneration; no client-side optimistic UI (server-redirect feedback only).
- No streaming preview of the prompt; the admin sees the finished version after generation.

## Decisions

### D1: Version rows in `match_summaries`, one `is_active` per match (chosen)
Drop `UNIQUE (match_id)`; allow multiple rows per match. Add `is_active boolean not null default false` and enforce **at most one active per match** with a partial unique index `UNIQUE (match_id) WHERE is_active`. Add `style_key text not null default 'neutral'` and `style_instruction text` (the resolved instruction actually injected; null for neutral). Backfill: existing rows → `is_active = true` (they are the current published recap), `style_key = 'neutral'`. Add a plain `match_id` index (the dropped unique previously served as the lookup index).

- *Alternative — separate `match_summary_versions` table with a `current_id` FK on `match_summaries`*: cleaner separation but doubles the read/write surface and the migration/backfill complexity for no functional gain at this scale. Rejected.
- *Alternative — overwrite-in-place (keep unique, mutate content)*: loses the compare-versions ability the feature is for. Rejected per product decision.

### D2: Public reads narrowed to the active version
Change RLS policy `match_summaries_select_public` to `USING (is_active)` so anon/authenticated reads never return drafts. The public match-detail page and live API additionally pass an explicit `.eq("is_active", true).maybeSingle()` (defensive + deterministic now that multiple rows exist). Admin reads use the service-role client (RLS-bypassing) and see all versions.

### D3: Two generation modes on one generator
Extend `generateMatchSummary(admin, matchId, opts?)` with `opts.mode`:
- `"auto"` (default): unchanged semantics for cron/sync and the list quick-action — skip with `reason: "exists"` when **any** version exists; on success insert with `is_active = true`, `style_key = 'neutral'`. (The existence check switches from `maybeSingle()` to "fetch up to 1 row" since multiple rows are now legal.)
- `"regenerate"`: skip the existence check entirely; always insert a **new draft** (`is_active = false`) with the supplied `style_key`/`style_instruction`; return the new version id. Concurrency: drafts carry no active-uniqueness, so no 23505 race; the auto path keeps its 23505→`exists` handling against the partial active index.

`buildSummaryPrompt(match, events, styleInstruction?)` appends a non-empty `styleInstruction` to the hardcoded system prompt, after the grounding constraints so "never invent facts" still dominates.

### D4: Style presets resolved server-side
A `STYLE_PRESETS: Record<string, string>` maps `neutral` (`""`), `dramatic`, `tactical`, `concise` to instruction fragments. The action accepts `style_key` ∈ {presets, `custom`}. For `custom`, the free-text `style_instruction` (trimmed, length-capped) is used verbatim and stored with `style_key = 'custom'`; for a preset, the fragment is stored as `style_instruction` (or null for neutral) with the preset `style_key`. Storing the resolved instruction makes each version auditable/reproducible.

### D5: Detail page composition
`app/[locale]/(admin)/admin/matches/[matchId]/page.tsx` (server): `setRequestLocale`, `getTranslations("admin")`, resolve managed competition, `assertMatchInManaged` (else `notFound()`), then load match + ordered events + all versions (service-role). Layout mirrors `competitions/[id]/page.tsx` (`mx-auto max-w-4xl`), `AdminPageHeader` (teams/score/status + back link), and `FormSection`s:
1. **Fixture** — read-only info via reused public components + a static server-rendered event timeline.
2. **Recap versions** — each version: content, `style_key` badge, model, `generated_at`, plus an **Active** badge; per non-active version a `setActiveSummaryVersion` form (`SubmitButton`) and a confirm-gated `deleteSummaryVersion` form; empty state when none.
3. **Regenerate** — `regenerate-summary-form.tsx` client component: preset radios + custom textarea + `SubmitButton`; disabled with a notice when the match has no events or the generator key is unset.

`ActionStatus` panels (driven by `regenResult` / `activateResult` / `deleteResult` + their match/version id params) and a single `LiveRegion` handle outcomes, matching the list page pattern.

### D6: Three server actions, same auth/scope fence
All begin `assertAdmin()` → `getManagedCompetition()` → `assertMatchInManaged(admin, match_id, managed.id)`, validate input with `zod`, mutate via the service-role client, `revalidateAfterMutation(...)` (revalidating the public `/matches/[matchId]` when managed is active), then `redirect()` back to the detail page with outcome params.
- `regenerateMatchSummary` — parse `match_id`, `locale`, `style_key`, optional `style_instruction`; resolve style; call generator in `regenerate` mode; map result → `regenResult` (`generated` | `no-events` | `not-final` | `no-key` | `missing` | `error`).
- `setActiveSummaryVersion` — parse `summary_id` + `match_id`; verify the version belongs to the match; set all the match's versions inactive, then set the chosen one active (two ordered updates); `activateResult = activated`.
- `deleteSummaryVersion` — parse `summary_id` + `match_id`; refuse when the row is active (`deleteResult = active-blocked`) so a match never silently loses its published recap; else delete (`deleteResult = deleted`).

## Risks / Trade-offs

- **Dropping the unique constraint is a one-way data-model change** → backfill sets every existing row active (each match has ≤1 today, so the partial unique index holds); migration is additive otherwise and the rollback is documented below.
- **Set-active is two non-transactional updates** → a crash between them could momentarily leave a match with zero active versions (public hides the recap, not an error). Acceptable for a single-admin tool; order updates as "deactivate-all then activate-one" so the failure mode is "no active" (hidden) rather than "two active" (which the partial unique index would reject anyway).
- **Deleting the active version is blocked** → admin must activate another version first; prevents an accidental "no recap" public state.
- **Free-text style is injected into the LLM prompt** → placed after the grounding/"never invent" constraints, length-capped, and stored verbatim for audit; the model is still told to use only the provided score + events.
- **Draft versions accumulate** → delete-draft control plus the batch limit (auto path only) keep growth in check; no automatic pruning.

## Migration Plan

1. Ship the SQL migration: drop `match_summaries_match_uq`; add `style_key`, `style_instruction`, `is_active`; `UPDATE` existing rows to `is_active = true`; create `UNIQUE INDEX ... WHERE is_active` and a plain `match_id` index; replace the public-select policy with `USING (is_active)`.
2. Regenerate `lib/database.types.ts`.
3. Deploy code (generator + actions + detail route + public-read filters). Old single-recap rows render unchanged as the active `neutral` version.
4. **Rollback**: code revert is safe (new columns ignored). To fully revert the schema, keep only each match's active row, drop the added columns/indexes, and restore `UNIQUE (match_id)` + the `USING (true)` policy.

## Open Questions

- Should the admin be able to **edit** a version's text by hand, or only regenerate? (Out of scope here; regenerate-only.)
- Should preset style fragments live in code (chosen) or be admin-configurable per competition? (Code for now.)
- Do we want a localized recap path later? The `locale` column already exists; style injection is orthogonal and would compose.
