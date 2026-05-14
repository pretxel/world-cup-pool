## Why

The DB trigger `trg_recompute_scores_on_match_change` recomputes prediction scores whenever `status`, `home_score`, or `away_score` actually change (`is distinct from old`). If an admin re-submits the result form with identical values — same final score, same `status='final'` — the trigger short-circuits and `public.scores` is never rebuilt. That's a problem when a previous save left scores in a bad state (e.g. earlier null-score save that wiped scores; a fix to `compute_match_scores` that needs a re-run; data correction that didn't change the visible columns). The admin's mental model is "saving the result computes scores," so the action should *guarantee* it on every submit instead of relying on a column-diff trigger.

## What Changes

- `setMatchResult` server action explicitly calls `compute_match_scores(p_match_id)` after the `matches` UPDATE succeeds, whenever the resulting status is `final`. This makes the recompute idempotent and unconditional on every final save.
- The DB function `compute_match_scores` already handles non-final / null-score cases by clearing scores and returning early, so calling it for non-final saves is also safe — we call it unconditionally for simpler code.
- Cache revalidation expanded so `/my-picks` reflects updated scores immediately after admin saves a final.

No DB schema changes. No new dependencies. No user-facing UI changes (admin form remains as-is).

## Capabilities

### New Capabilities
- `match-results`: rules governing how an admin saves a match result and how prediction scores are recomputed.

### Modified Capabilities
<!-- none — no overlap with predictions-lock; that capability covers user prediction writes, this one covers admin result writes. -->

## Impact

- Code: `app/(admin)/admin/matches/actions.ts#setMatchResult`.
- DB: no migrations.
- Tests: extend admin action tests (or add new) verifying `compute_match_scores` RPC invoked on save; integration test that re-saving the same final still produces fresh `scores` rows.
- Cache: extra `revalidatePath("/my-picks")` after final save.
