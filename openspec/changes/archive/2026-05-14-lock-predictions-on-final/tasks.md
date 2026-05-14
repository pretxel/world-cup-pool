## 1. Database migration

- [x] 1.1 Create `supabase/migrations/<ts>_lock_predictions_on_final.sql` that drops `predictions_insert_own_before_kickoff` and `predictions_update_own_before_kickoff`, then recreates each with the predicate extended to require `m.status = 'scheduled'` (USING and WITH CHECK clauses).
- [ ] 1.2 Apply locally (`supabase db reset` or `supabase migration up`) and confirm the policies show the new predicate via `select polname, pg_get_expr(polqual, polrelid) from pg_policy where polname like 'predictions_%';`.
- [ ] 1.3 Sanity check with `psql`: insert + update fail with `42501` for matches in `final`, `cancelled`, and `live` states; succeed for a `scheduled` match with future `kickoff_at`.

## 2. Lock helper

- [x] 2.1 In `lib/match-utils.ts`, widen `isLocked` signature to `Pick<MatchRow, "kickoff_at" | "status">` and return `true` when `status !== 'scheduled'` OR `new Date(kickoff_at).getTime() <= Date.now()`.
- [x] 2.2 Add a `lockReason(match)` helper returning `'final' | 'cancelled' | 'live' | 'kickoff' | null` (null = not locked) for use by UI copy.
- [x] 2.3 Update all `isLocked(...)` call sites to pass `status` (search: `isLocked(`). Verify TypeScript compiles.

## 3. Server action

- [x] 3.1 In `app/(public)/matches/[matchId]/actions.ts#submitPrediction`, after auth check, fetch `status, kickoff_at` for the target `matchId` via `.from("matches").select("status, kickoff_at").eq("id", matchId).maybeSingle()`. Return `{ ok: false, error: "Match not found." }` if missing.
- [x] 3.2 Map non-`scheduled` statuses to the error strings defined in the spec (`final`/`cancelled`/`live`) and return early.
- [x] 3.3 For `status = 'scheduled'` with `kickoff_at <= now()`, return `"Predictions are locked — kickoff has passed."` early.
- [x] 3.4 Keep the existing `42501` / `row-level security` regex branch as a defensive fallback in case the pre-check races with an admin status update between read and write.

## 4. UI copy

- [x] 4.1 In `app/(public)/matches/[matchId]/page.tsx`, replace the static "Predictions are locked at kickoff." copy with text driven by `lockReason(match)` — distinct messages for `final`, `cancelled`, `live`, and `kickoff`.
- [x] 4.2 Verify the `MatchStateBadge` still renders the correct `uiStatus` (no change expected — the existing mapping already prefers `match.status` over `locked`).
- [x] 4.3 In `app/(app)/my-picks/page.tsx`, ensure the "Edit" link is hidden when `lockReason(m)` is non-null (currently only checks `isLocked` — confirm new behavior covers the `status='final'+future kickoff` case).

## 5. Tests

- [x] 5.1 Add unit tests for `isLocked` and `lockReason` in a new `tests/match-utils.test.ts`: covers `scheduled`+future, `scheduled`+past, `live`, `final`, `cancelled`, and `final`+future-kickoff cases.
- [ ] 5.2 Add an integration test (or extend `tests/scoring.test.ts` with a Supabase-client test, matching the existing test style) that asserts an authenticated user upsert against a `status='final'` match is rejected by RLS.
- [x] 5.3 Run `pnpm test` and confirm all tests pass.

## 6. Verification

- [x] 6.1 Run `pnpm typecheck` and `pnpm lint` — zero errors.
- [ ] 6.2 Manually verify in dev: as a regular user, the match detail page for a finalized match shows the "match is final" banner, and submitting via DevTools network replay returns the status-specific error string.
- [ ] 6.3 Manually verify the `/my-picks` row for a finalized match has no Edit link.
- [x] 6.4 Run `openspec verify lock-predictions-on-final` and address any reported gaps.
