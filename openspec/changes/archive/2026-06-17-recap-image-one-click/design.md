## Context

Two shipped capabilities provide the pieces:
- `match-recap-image-prompt`: `generateMatchImagePrompt(admin, summaryId)` enriches a
  recap's `content` into the comic `image_prompt` (returns `{ generated, reason? }`).
- `match-recap-image-render`: `requestMatchImageRender(admin, summaryId)` POSTs that
  prompt to Leonardo and records a pending render (returns `{ requested, reason? }`).

The admin match detail page exposes these as separate per-version buttons (Generate
image prompt / Render image / Sync render), each a `<form action={serverAction}>` whose
server action validates admin + managed scope, runs the work in a try/catch, and
redirects with an outcome query param resolved to an `ActionStatus` panel. This change
adds one button that runs both steps back-to-back.

## Goals / Non-Goals

**Goals:**
- One admin click: generate the `image_prompt`, then request the render, for a version.
- Clear combined reporting: success / partial (prompt ok, render skipped or failed) /
  prompt-failed — never a server-error page.
- Zero new external surface: reuse the two existing functions; no schema/env/storage.

**Non-Goals:**
- Removing or changing the existing granular buttons (kept for fine-grained control).
- Changing prompt or render internals, the auto (sync-flow) chain, or the webhook.
- Waiting for the async render to finish (the render stays async; the image still
  arrives via the webhook/poll, unchanged).

## Decisions

### One server action that sequences the two calls
Add `generateAndRenderImageAction(formData)` in the admin matches `actions.ts`, built
exactly like the existing `generateMatchImagePromptAction` / `renderMatchImageAction`:
`assertAdmin` → `getManagedCompetition` → parse `versionActionSchema` → `createAdminSupabaseClient`
→ `assertMatchInManaged` → confirm the version belongs to the match. Then:
1. `const prompt = await generateMatchImagePrompt(admin, summary_id)`.
2. Only if `prompt.generated`, `const render = await requestMatchImageRender(admin, summary_id)`.
3. Map to one outcome code and `revalidateAfterMutation(managed.is_active, "/matches/<id>")`,
   then redirect with `comboResult=<code>`.

Sequencing (not parallel) is required: the render reads the `image_prompt` the first
step writes. Each step keeps its own failure handling; a thrown error in either is
caught and mapped to an error outcome (mirrors the existing actions).

### Outcome code mapping
A single `comboResult` family keeps the page's resolver simple:
- `rendered` — prompt generated AND render requested → success.
- `prompt-only` — prompt generated, render skipped/failed (e.g. `no-key`, `no-prompt`,
  or a caught render error) → info/partial, telling the admin the prompt is ready but
  no render was started.
- `no-key` — prompt step returned `no-key` (OpenRouter unset) → info (nothing happened).
- `error` — prompt step failed for another reason, or scope/validation failed.

Rationale: the admin's mental model is "did I get an image started?" `rendered` vs
`prompt-only` answers that; finer render reasons are already visible via the per-version
render status badge added by the render change.

### UI
Add a **"Generate & render image"** button in the existing per-version action row,
disabled when `!hasKey` (OpenRouter) — the same gate as the prompt button, since the
prompt step must run first. The render half self-skips when the Leonardo key is unset
(surfaced as `prompt-only`). The existing buttons stay.

## Risks / Trade-offs

- **Double LLM/credit spend per click** (a fresh prompt + a render each time) → That is
  the explicit intent of a one-click "make the picture"; admins who want to reuse an
  existing prompt still have the separate Render button. Both steps are key-gated.
- **Partial success confusion** → The dedicated `prompt-only` outcome states exactly
  what happened; the render status badge reflects the rest.
- **Always regenerates the prompt** (vs reuse-if-present) → Chosen for predictability
  ("generate the image from the recap" = fresh prompt); the standalone Render button
  covers reuse of an existing prompt.

## Open Questions

- Button placement/label wording per locale — finalize in the i18n task; "Generate &
  render image" is the working label.
