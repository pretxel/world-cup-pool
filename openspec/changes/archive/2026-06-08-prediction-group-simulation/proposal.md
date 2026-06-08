## Why

Players predict scorelines match-by-match but never see what their picks _add up to_. The whole point of the group stage is who advances — yet a user filling in "Mexico 2–1, Mexico 3–0, …" has no view of whether their predictions send Mexico through. A simulated group table turns a pile of scorelines into a story (qualifiers, knife-edge ties, group winners) and pulls users back to complete every group's picks.

## What Changes

- Add a **simulated group standings** view that computes each tournament group's table (played / W / D / L / GF / GA / GD / points) purely from the signed-in user's own predicted group-stage scorelines.
- Standings use football points (win = 3, draw = 1, loss = 0) and order teams by **points → goal difference → goals for → team name (A–Z)**.
- Only matches the user has actually predicted contribute. Unpredicted group matches are skipped entirely — a team's "played" count reflects how many of its group games the user has picked, and real/live/final results are never mixed in.
- Surface the section in two places:
  - **Match detail page** — under the prediction form, render the simulated table for _that match's group_, so a fresh pick updates the standing the user is looking at. A link points to the full all-groups view.
  - **My Picks page** — render all twelve group tables together, built from the same engine.
- The simulation is **prediction-only and personal**: it reflects "if my picks came true," is recomputed on every read, persists nothing, and is never shown to other users.
- Knockout-stage (`stage != 'group'`) predictions are out of scope for this section.

## Capabilities

### New Capabilities
- `group-simulation`: A personal, prediction-derived standings table for each tournament group — how points, goal stats, and rank are computed from a user's predicted group-stage scorelines, which matches contribute, how ties order, and where/how the table is surfaced (match detail + My Picks).

### Modified Capabilities
<!-- None. Group standings are derived read-only from existing predictions; no existing spec's requirements change. -->

## Impact

- **New code**: a pure standings engine in `lib/` (group rows from predictions, FIFA-lite ordering — unit-testable, no DB), plus a `GroupSimulation` component and an all-groups renderer.
- **Match detail page** (`app/[locale]/(public)/matches/[matchId]/`): fetch the match's group fixtures + the user's predictions for them, render the table beneath the form.
- **My Picks page** (`app/[locale]/(app)/my-picks/page.tsx`): fetch all group fixtures + the user's predictions, render twelve tables.
- **Data**: read-only over existing `matches` (`stage`, `group_code`, `home_team`, `away_team`) and `predictions` (`home_goals`, `away_goals`). No schema migration, no new table, no RLS change.
- **i18n**: new `groupSimulation` message keys across `en` / `es` / `fr`.
- **Tests**: `tests/` unit coverage for the standings engine (ordering, tie-breaks, partial groups, skip-unpredicted).
