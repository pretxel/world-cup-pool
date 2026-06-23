## 1. DB scoring function

- [ ] 1.1 Add a migration (timestamp after the latest) that `CREATE OR REPLACE`s `public.compute_match_scores`: also select `stage`, derive a multiplier via `CASE` (group 1, r32 2, r16 4, qf 6, sf 8, final 10, third 4; else 1), and write `points = <base CASE> * <multiplier>`. Keep the `hit_type` CASE and the rest of the function (delete-then-insert, final/null guards) identical. Do NOT add a recompute loop. Re-`grant execute ... to authenticated`.

## 2. TS replica

- [ ] 2.1 In `lib/scoring.ts`, add `export const STAGE_POINT_MULTIPLIER: Record<string, number>` (same values; default 1) and an optional `stage?: string` arg to `scorePrediction` that multiplies the base points (default → ×1, preserving current behavior). Keep `hit_type` unchanged.

## 3. Tests

- [ ] 3.1 Update/extend `tests/scoring.test.ts`: existing no-stage cases still pass (×1); add cases asserting exact-in-final = 50, winner_gd-in-r32 = 6, group = base, and miss = 0 at any stage; assert `STAGE_POINT_MULTIPLIER` has the agreed values.

## 4. Landing explainer

- [ ] 4.1 Export the base point values from `lib/scoring.ts` (e.g. `BASE_POINTS = { exact: 5, winner_gd: 3, winner: 1 }`) alongside `STAGE_POINT_MULTIPLIER` so the UI can derive points without hardcoding.
- [ ] 4.2 Add `components/scoring-explainer.tsx` (server component): for each stage (group, r32, r16, qf, sf, final, third), render the points on offer = base × multiplier, using `getStageLabel(format, stage, locale)` for names (fallback to the key); read multipliers/base from `lib/scoring.ts`.
- [ ] 4.3 Mount it on `app/[locale]/page.tsx`; add a `scoring` i18n namespace (eyebrow/heading/lede + column labels exact/winner+GD/winner) in `messages/{en,es,fr,de}.json`.

## 5. Verification

- [ ] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix failures.
- [ ] 5.2 After applying the migration to the DB, verify with a quick check: a finalized `final` match's score rows carry base×10 points; a `group` match's rows are unchanged; leaderboard totals reflect the weighted points.
- [ ] 5.3 Verify the landing scoring section renders the per-phase points (e.g. exact final = 50) across all four locales and matches the multipliers.
