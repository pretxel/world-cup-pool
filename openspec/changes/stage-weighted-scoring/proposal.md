## Why

Prediction scoring is flat: every correct pick is worth the same (5 exact / 3 winner+GD / 1 winner / 0 miss) whether it's a group match or the final. Nailing a knockout result should be worth more than a group-stage one — stage-weighted scoring rewards getting the high-stakes matches right and keeps the leaderboard meaningful deep into the tournament.

## What Changes

- Scale prediction points by the match's stage, multiplying the existing base (5/3/1/0) by a per-stage factor (**strong escalation**): group ×1, Round of 32 ×2, Round of 16 ×4, Quarter-final ×6, Semi-final ×8, Final ×10, Third-place play-off ×4. The `hit_type` (exact / winner_gd / winner / miss) is unchanged — only `points` scale.
- Implement the weighting in the source of truth, the Postgres `compute_match_scores` function, by reading `matches.stage` and applying the multiplier.
- Keep the pure TS replica `lib/scoring.ts` in sync (it mirrors the SQL for unit tests) — add the stage multiplier there too.
- **Explain the scoring on the landing page**: a section that shows, per phase (group → final + third-place), the points on offer (base exact/winner+GD/winner × the stage factor), rendered from the shared `STAGE_POINT_MULTIPLIER` constant so the explainer can't drift from the actual scoring.
- **No backfill** (per decision): existing scored matches keep their current points; only matches scored from now on use the weights. (Group matches are ×1, so already-scored group results are identical under the new scheme; no knockout has been scored yet, so there is no cross-round inconsistency in practice.)

## Capabilities

### New Capabilities
- `stage-weighted-scoring`: prediction points are the base accuracy points (5/3/1/0) multiplied by a per-stage factor, so later knockout rounds are worth more; `hit_type` is unchanged and the leaderboard aggregates the weighted points.

### Modified Capabilities
<!-- None at the spec level. compute_match_scores keeps its recompute contract (match-results); only the point value it writes changes. -->

## Impact

- **Migration**: `CREATE OR REPLACE public.compute_match_scores` — select `stage`, apply a `CASE` multiplier on the base points (unknown stage → ×1). No recompute loop (going-forward only). Must be applied to prod.
- **`lib/scoring.ts`**: `scorePrediction` gains an optional `stage` and a `STAGE_POINT_MULTIPLIER` map mirroring the SQL `CASE`; default keeps existing behavior. Update `tests/scoring.test.ts`.
- **Leaderboards/scores**: `scores.points` is `smallint` — max becomes 5×10 = 50, well within range. Aggregations (v_leaderboard_overall, group board, segmented RPCs) are unaffected structurally; totals just reflect weighted points.
- **Landing**: a new "how scoring works" section + component on `app/[locale]/page.tsx`, reading `STAGE_POINT_MULTIPLIER` + base points from `lib/scoring.ts`; new `scoring` (or `home.*`) i18n keys in en/es/fr/de. No new dependency.
