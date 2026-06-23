## Context

`public.compute_match_scores(p_match_id)` (init migration, `security definer`) is the single source of truth for `public.scores`: on a final match it deletes existing score rows and inserts one per prediction with `points` (5/3/1/0) and `hit_type` (exact/winner_gd/winner/miss) via two parallel `CASE`s. It already selects the match row; it does not read `stage`. `lib/scoring.ts` `scorePrediction` is a pure TS replica used only by unit tests (no UI/runtime caller — verified). Leaderboards (`v_leaderboard_overall`, `leaderboard_for_group`, the segmented RPCs) sum `scores.points`.

Stages come from the competition format: `group, r32, r16, qf, sf, third, final`.

## Goals / Non-Goals

**Goals:**
- Weight points by stage (strong escalation) at the DB level; keep `hit_type` flat.
- Keep the TS replica + tests in sync.
- Going-forward only (no recompute of already-scored matches).

**Non-Goals:**
- Changing the hit_type tiers or the base 5/3/1 values.
- Backfilling/recomputing historical scores.
- UI to advertise per-stage point values (possible follow-up).
- Touching leaderboard aggregation logic.

## Decisions

### Decision: Multiplier on the base, in `compute_match_scores`
Add `stage` to the match `select`, derive `v_mult` via `CASE` (group 1, r32 2, r16 4, qf 6, sf 8, final 10, third 4; else 1), and write `points = base * v_mult`. The base/hit_type `CASE`s are unchanged; only the points `CASE` is multiplied. `else 1` makes any unknown/future stage safe (no zeroing).

*Why multiplier, not flat per-stage tables:* preserves the meaningful exact>gd>winner ordering within every stage while scaling the stakes; one factor per stage is easy to reason about and mirror.

### Decision: No recompute loop
The migration only redefines the function; it does NOT iterate `compute_match_scores` over existing finals. Group matches are ×1 (identical to today), and no knockout match has been scored yet, so "going-forward only" introduces no visible inconsistency. (A later recompute of an old match — score correction, resync — will naturally apply the new weights, which is acceptable and self-healing.)

### Decision: Mirror in `lib/scoring.ts`
Add `export const STAGE_POINT_MULTIPLIER: Record<string, number>` and an optional `stage` arg to `scorePrediction` (default → ×1) so the replica matches the SQL and stays unit-testable. Existing callers/tests without a stage keep current numbers.

### Decision: Landing explainer reads the shared constant
A landing section (`components/scoring-explainer.tsx`, rendered on `app/[locale]/page.tsx`) renders the per-phase points table from `STAGE_POINT_MULTIPLIER` + the base values (exact 5 / winner_gd 3 / winner 1) exported by `lib/scoring.ts` — never hardcoded — so the UI is provably consistent with the scorer. Stage labels come from the active competition format (`getStageLabel`), falling back to the stage key. Server component (it can read the active competition); copy is localized.

*Why read the constant:* the multipliers now live in three places (SQL, TS replica, UI). Making the UI derive from the TS constant removes one drift source; the SQL↔TS parity is pinned by the scoring test, and the SQL `else 1` keeps unknown stages safe.

## Risks / Trade-offs

- **[smallint overflow]** → max points 5×10 = 50; `scores.points` is `smallint` (max 32767). Fine.
- **[Cross-round inconsistency if an old KO match were already scored]** → none today (no KO scored); group ×1 unchanged. Documented.
- **[SQL CASE and TS map drift]** → keep them adjacent in the migration + lib with matching values; a unit test pins the TS multipliers.
- **[Recompute of an old match applies new weights]** → intended/self-healing; only affects KO matches, of which none are scored yet.

## Migration Plan

One migration (`CREATE OR REPLACE compute_match_scores` with the stage `CASE`) + `lib/scoring.ts` + tests. Apply the migration to prod (DB function). No data migration/backfill. Rollback = restore the flat-points function body.
