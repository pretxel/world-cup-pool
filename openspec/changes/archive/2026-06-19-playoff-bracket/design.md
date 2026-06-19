## Context

Knockout fixtures (R32→final, 32 rows) live in `public.matches` with `stage` in {r32,r16,qf,sf,third,final}, `group_code` NULL, and placeholder participants in `home_team`/`away_team`:
- R32: `Winner Group X`, `2nd Group X`, `3rd Group X/Y/Z/W/V` (5 candidate groups).
- R16→final: `Winner Match NN` / `Loser Match NN` (FIFA match numbers).

`isConfirmedMatch` (`lib/match-utils.ts`) hides any row whose teams lack a flag, so placeholders never reach the public list. The real group standings engine (`buildGroupTables` in `lib/group-standings.ts`) already produces ranked rows per group from synced `final` results — rank 1/2/3 are exactly what R32 needs. No bracket UI exists; `components/mini-bracket.tsx` is a hardcoded landing demo (QF→final only).

Group and R32 dates overlap (group ends 2026-06-28, R32 starts 2026-06-28), so match numbers must come from `(stage order, kickoff, id)` — never global date order.

## Goals / Non-Goals

**Goals:**
- Public `/bracket` page showing the full knockout bracket for the active competition.
- Project R32 from live standings: `Winner/2nd Group X` from current rank 1/2, flagged provisional until the group is complete.
- Resolve `3rd Group …` slots via the official best-third allocation once all 12 groups finish.
- Resolve R16→final slots from recorded knockout results (`Winner/Loser Match NN`).
- Pure, unit-tested resolution core; responsive bracket UI; localized.

**Non-Goals:**
- Predicting knockout winners (later rounds fill only from actual recorded results, never guessed).
- Writing resolved teams back to the DB or changing the admin rename flow (this is a read-only projected view; admin remains the source of truth for committed fixtures).
- Prediction-based ("if my picks came true") brackets — out of scope; this is results-driven only.
- Schema changes or new external data.

## Decisions

### Decision: Compute on read in `lib/bracket.ts`, pure core split out
Server loader loads all active-competition matches (group + knockout), calls `buildGroupTables` for ranks, builds the match-number map, then resolves each knockout fixture. A DB-free core (parsers, match numbering, slot resolution, best-third allocation) lives in a separate module imported by both the loader and tests — same pattern as `group-table.ts` / `group-standings.ts`.

*Why:* Reuses the tested standings engine; keeps resolution logic testable without Supabase; no persistence to keep the projection always-live.

### Decision: Match numbering from `(stage order, kickoff, id)`
Number fixtures within stage-order buckets: group → 1–72, r32 → 73–88, r16 → 89–96, qf → 97–100, sf → 101–102, third → 103, final → 104. Sort each stage by kickoff then id for a stable sequence. `Winner Match NN`/`Loser Match NN` then map to a fixture; its winner/loser comes from the recorded score when `status = 'final'`.

*Alternative considered:* A stored `match_number` column — rejected (schema change; the order is derivable). Risk: our seed's kickoff order must match FIFA's official numbering (it was generated in bracket order from Wikipedia) — covered by a test asserting the 73→R32-1 … 104→final mapping.

### Decision: R32 slot resolution with provisional/confirmed status
Parse the placeholder:
- `Winner Group X` → group X rank 1; `2nd Group X` → rank 2.
- Each resolved participant carries a status: **confirmed** when group X has played all its matches, else **provisional** (current leader, may change). A group with zero results yields no projection — the slot stays a placeholder (nothing meaningful to show yet).
- `3rd Group X/Y/Z/W/V` → see best-third decision.

*Why:* "Consider current standings" means live projection; the provisional flag keeps it honest as standings shift.

### Decision: Best-third slots via the official allocation table
The 8 best third-placed teams (of 12) qualify; FIFA publishes a fixed table mapping the *set of 8 qualifying group letters* → which group's third fills each `3rd Group …` slot. Resolve these slots only when **all 12 groups are complete** (so the best-8 set and their ranking are final). Until then, render the candidate-group placeholder. The table is generated into a static module (495 = C(12,8) entries keyed by the sorted 8-letter combination).

*Alternative considered:* Deriving the assignment at runtime by constraint-matching candidate lists — rejected as risk of diverging from FIFA's official table in edge cases; the published table is authoritative. A generator script + a spot-check test cover it.

### Decision: R16→final from recorded results only
`Winner Match NN`/`Loser Match NN` resolve to the winner/loser of the numbered fixture when it has a `final` score; otherwise the slot stays an (optionally source-labelled) placeholder. These never project from standings — they depend on knockout outcomes.

### Decision: Dedicated `/bracket` page + new `BracketView`
Server component mirroring `/standings` conventions (locale, metadata, opportunistic sync, nav link). New `components/bracket-view.tsx` renders round columns (R32 → final + third-place) with connectors, `TeamFlag`, and stage icons; horizontally scrollable on mobile. `mini-bracket` (landing demo) is untouched.

## Risks / Trade-offs

- **Seed match order ≠ FIFA numbering** → a unit test pins the number→fixture map; if a fixture's kickoff is off, the test catches it.
- **Best-third table is large/error-prone** → generate it from a published source via a script, commit as data, and spot-check known combinations in a test. Until groups complete, the feature degrades to candidate placeholders, so a table bug can't mislead mid-tournament.
- **Provisional projections churn early** → clearly label provisional vs confirmed; groups with no results show placeholders, avoiding meaningless name-tiebreak "leaders".
- **Wide bracket on mobile** → round-column layout with horizontal scroll and sticky round headers; reuse the responsive table patterns already in the app.
- **Knockout fixtures hidden elsewhere by `isConfirmedMatch`** → the bracket view deliberately renders placeholders (does not use that gate); no change to the matches list.

## Migration Plan

Additive: new route, loader + core, data module, component, one i18n namespace, one nav link. No schema or data migration. Rollback = remove the route + nav link.

## Open Questions

- None blocking. (If our seed numbering ever diverges from FIFA's, fix the seed; the test will flag it.)
