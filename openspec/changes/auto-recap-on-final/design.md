## Context

The recap pipeline has three stages, all already implemented as single-item functions:
1. **Summary** — `generateMatchSummary` (OpenRouter). Auto-run in batch by `generatePendingSummaries`, called from the `sync-matches` cron.
2. **Image prompt** — `generateMatchImagePrompt(admin, summaryId)` writes `match_summaries.image_prompt`. Only called from admin actions today.
3. **Render** — `requestMatchImageRender(admin, summaryId)` reads `image_prompt`, calls Leonardo, and the render finalizes asynchronously via `/api/callback-image` (`finalizeRender`) into `match_summary_images` (`status` pending→complete). Only called from admin actions today.

`generatePendingSummaries` is the model to copy: load recent finals, anti-join against what already exists, generate the missing ones, gated on the relevant API key, returning `{candidates, generated, skipped, errors}`. The cron already runs it inside an isolated try/catch and folds its count into the run summary.

Active-version scoping: a match has at most one active summary (`match_summaries.is_active`); the prompt/render operate on the active version, consistent with how the public surfaces read it.

## Goals / Non-Goals

**Goals:**
- After finalize, automatically produce the image prompt and request the Leonardo render with no admin action.
- Idempotent, isolated, key-gated; reuse the existing single-item functions and webhook.

**Non-Goals:**
- Changing the summary generation, the Leonardo request shape, or the `/api/callback-image` finalize path.
- Removing the admin one-click (it stays as manual regenerate/override).
- A new cron route or schema change.
- Synchronously waiting for the image (it remains async via webhook).

## Decisions

### Decision: Two new batch passes mirroring `generatePendingSummaries`
- `generatePendingImagePrompts(admin, {limit})` in `lib/matches/match-image-prompt.ts`: select active summaries (recent finals) where `image_prompt` is null/empty, call `generateMatchImagePrompt` for each. Gated on `OPENROUTER_API_KEY`. Returns `{candidates, generated, skipped, errors}`.
- `requestPendingRenders(admin, {limit})` in `lib/matches/match-image-render.ts`: select active summaries that have a non-empty `image_prompt` and **no** `match_summary_images` row, call `requestMatchImageRender` for each. Gated on `LEONARDO_API_KEY`. Returns `{candidates, requested, skipped, errors}`.

Anti-join in one query each (PostgREST has no clean anti-join), same as the summary pass.

### Decision: Chain within one cron run, after summaries
Order in `sync-matches`: summaries → prompts → renders. Each pass scans for what's still pending, so the prompt pass picks up summaries created earlier in the same run, and the render pass picks up prompts just written. If a step is missed (timing/limit), the next cron run catches it — the passes are convergent, not one-shot.

*Alternative considered:* drive prompt/render from the summary function directly (tight coupling) — rejected; separate convergent passes keep each stage independently retryable and key-gated, and avoid a long synchronous chain inside one summary call.

### Decision: Idempotency / no duplicates
- Prompt pass skips summaries that already have `image_prompt`.
- Render pass skips summaries that already have a `match_summary_images` row (any status) — so a pending or failed render is not re-requested by the cron (failures are recovered via the admin poll/retry, unchanged). This prevents duplicate Leonardo spend.

## Risks / Trade-offs

- **[Leonardo cost / runaway]** → render pass is bounded by the batch limit and the "no existing render row" guard, so each summary is requested at most once automatically.
- **[A failed render blocks auto-retry]** → intentional: a `failed` row stops the cron from re-billing; admin retry remains. Documented.
- **[Key unset]** → both passes no-op (like the summary pass without OpenRouter), so non-configured environments are unaffected.
- **[Webhook unreachable in non-prod]** → unchanged behavior; the admin sync/poll fallback still finalizes a stuck render.

## Migration Plan

Code-only: two lib functions + cron wiring + summary counts. No DB migration, no new env. Rollback = remove the two cron steps.
