## Why

The bracket already projects group winners and runners-up **provisionally** from live standings, but the `3rd Group X/Y/…` slots stay as bare candidate-group placeholders until **every** group has finished all its matches. During most of the group stage the bracket therefore shows concrete teams for the 1st/2nd slots and dead placeholders for the eight best-third slots — an inconsistent, less useful view. We can project the provisional best-third teams from current standings too, just like winners/runners-up.

## What Changes

- Project the best-third slots **provisionally** once every group has at least one result: rank the current third-placed teams across all groups, take the current best 8, apply the official allocation table, and fill each `3rd Group …` slot with the projected team — marked **provisional** (it updates as results come in).
- Keep the existing behavior at the ends: **candidate placeholder** before every group has a result (nothing meaningful to rank), and **confirmed** once all groups complete (the qualifying set and order are final — unchanged).
- No UI change needed: the bracket already renders `provisional` participants with their distinct styling.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `playoff-bracket`: the best-third requirement now also produces a provisional projection (from current standings, via the same allocation table) before all groups complete, instead of only a candidate placeholder.

## Impact

- **`lib/bracket-core.ts`**: replace `qualifyingThirdGroups` (returns the set only when all groups complete) with a version that also computes the current best-8 set once every group has a result, returning a `provisional` flag; the third-slot resolution uses the allocation in both cases and marks the participant `provisional` vs `confirmed` accordingly.
- **No schema, env, migration, or UI change** — `BracketView` already styles provisional participants; the allocation table and `compareTeamRows` tie-break are reused.
- Tests for the new provisional path (and that pre-results still shows placeholders, completion still confirms).
