## 1. Pending image-prompt pass

- [ ] 1.1 Add `generatePendingImagePrompts(admin, { limit })` to `lib/matches/match-image-prompt.ts`, mirroring `generatePendingSummaries`: load active summaries of recent final matches (`match_summaries.is_active`, joined to `matches.status='final'`) whose `image_prompt` is null/empty, and call `generateMatchImagePrompt` for each. Gate on `env.openrouterApiKey` (no-op + return zeros when unset). Return `{ candidates, generated, skipped, errors }`.

## 2. Pending render pass

- [ ] 2.1 Add `requestPendingRenders(admin, { limit })` to `lib/matches/match-image-render.ts`: load active summaries with a non-empty `image_prompt` that have NO `match_summary_images` row (anti-join, any status), and call `requestMatchImageRender` for each. Gate on `env.leonardoApiKey` (no-op + return zeros when unset). Return `{ candidates, requested, skipped, errors }`.

## 3. Cron wiring

- [ ] 3.1 In `app/api/cron/sync-matches/route.ts`, after the `generatePendingSummaries` step, run `generatePendingImagePrompts` then `requestPendingRenders` (each in its own try/catch, logged-not-thrown), and fold their counts into the run summary (e.g. `imagePrompts`, `renders`).

## 4. Tests

- [ ] 4.1 Unit-test the two passes (pure selection + gating): no-op when the relevant key is unset; only summaries missing the next artifact are processed (idempotency); a single-item failure increments `errors` without aborting the batch. Mock the Supabase admin client + the single-item fns, as existing match-summary/render tests do.

## 5. Verification

- [ ] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix failures.
- [ ] 5.2 Manually verify (or via the unit tests + a dry cron hit) that a final match with a summary gets an `image_prompt` then a `match_summary_images` render row, that re-running the cron creates no duplicates, and that everything no-ops when the AI keys are unset.
