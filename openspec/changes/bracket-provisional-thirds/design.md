## Context

`lib/bracket-core.ts` resolves each R32 `3rd Group X/Y/…` slot via the official Annex-C allocation, but only once the group stage is fully done:

- `qualifyingThirdGroups(ctx)` returns `null` unless `ctx.allGroupsComplete`; otherwise it ranks the 12 third-placed rows (`compareTeamRows`) and returns the top-8 group letters.
- `buildBracket` computes `thirdAlloc = q ? allocateBestThirds(q) : null`; the `case "third"` resolution fills the slot from `thirdAlloc[winnerLetter]`'s rank-3 team with status `confirmed`, else `placeholder`.

Winners/runners-up already project provisionally via `groupParticipant` (status `provisional` until the group is complete). Third slots are the only ones that stay placeholders mid-stage. `BracketView` already renders any `provisional` participant with the distinct treatment, so this is a pure resolution-logic change.

## Goals / Non-Goals

**Goals:**
- Fill third slots with a provisional projection from current standings once every group has a result.
- Reuse the existing allocation table and tie-break; mark provisional vs confirmed correctly.
- Preserve the placeholder (no results) and confirmed (all complete) ends.

**Non-Goals:**
- Changing the allocation table, the tie-break, or the UI.
- Projecting before every group has at least one result (a name-tiebreak "3rd" is meaningless — keep the placeholder, mirroring how winner/2nd skip zero-result groups).
- Touching winner/runner-up or later-round resolution.

## Decisions

### Decision: `qualifyingThirds(ctx)` → `{ groups: string[]; provisional: boolean } | null`
Compute the best-third set in both regimes:
- Gather groups that have a results-backed third (`ctx.hasResults.has(code)` and `rows[2]` present).
- Require **all** groups to be represented (`count === ctx.rowsByCode.size`) and at least 8 — so the ranking is over every group's real current third, not a partial/name-tiebreak set.
- Sort by `compareTeamRows`, take the top 8 letters.
- `provisional = !ctx.allGroupsComplete`.
- Return `null` (→ placeholder) when not every group has a result yet.

*Why "all groups have a result" as the threshold:* it's the earliest point where every group's current third is real, so the best-8 ranking is meaningful — consistent with winner/2nd skipping zero-result groups. Relaxing to "≥8 determinable" would let a not-yet-played group be silently excluded from candidacy.

### Decision: status from the allocation regime, not the group
In `case "third"`, when `thirdAlloc` resolves a group, set the participant status to `provisional` when the projection is provisional, else `confirmed`. The provisional-ness here is about the **whole best-third set** (it can reshuffle as any group's standings change), which is broader than a single group's completeness — so use the set-level flag, not `groupParticipant`'s per-group status.

## Risks / Trade-offs

- **[Provisional thirds churn as standings shift]** → intended and expected; the `provisional` styling signals it, exactly like winner/2nd projections.
- **[Allocation lookup needs a valid 8-combo]** → the current top-8 letters always form a valid `comboKey` (C(12,8)); `allocateBestThirds` returns the mapping. If the table somehow lacks the combo it returns null → placeholder (safe).
- **[Before all groups have a result]** → unchanged placeholder; no regression.

## Migration Plan

Single-file logic change in `lib/bracket-core.ts` + tests. No DB/UI/env change. Rollback = restore the all-complete-only `qualifyingThirdGroups`.
