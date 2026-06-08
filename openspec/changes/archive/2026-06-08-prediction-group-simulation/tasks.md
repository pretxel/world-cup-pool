## 1. Standings engine (pure, no DB)

- [x] 1.1 Add `lib/group-standings.ts` with a `GroupTeamRow` type (`team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff, points, rank`)
- [x] 1.2 Implement `simulateGroup(fixtures, predictionsByMatchId)`: seed all distinct teams from fixtures, fold in only fixtures that have a prediction, award 3/1/0, accumulate GF/GA/GD
- [x] 1.3 Implement ordering: points desc → GD desc → GF desc → team name asc (case-insensitive); assign `rank` starting at 1
- [x] 1.4 Add a `groupFixturesByCode(fixtures)` helper that buckets group-stage fixtures by `group_code` for the all-groups view
- [x] 1.5 Export a thin `simulateAllGroups(fixtures, predictionsByMatchId)` returning an ordered map/array of `{ groupCode, rows }`

## 2. Engine unit tests

- [x] 2.1 Add `tests/group-standings.test.ts` covering win/draw/loss points (1W/1D/1L → 4 pts) and GF/GA/GD aggregation
- [x] 2.2 Test both teams of a single predicted match update correctly (home win ⇒ away loss)
- [x] 2.3 Test tie-break ladder: points, then GD, then GF, then name — one case isolating each tier
- [x] 2.4 Test skip-unpredicted: partial group counts only predicted fixtures; `played` reflects picks (0–3)
- [x] 2.5 Test zero-prediction group: all teams present at played = 0 / points = 0 (empty-state input)

## 3. Presentational component

- [x] 3.1 Add `components/group-standings-table.tsx` rendering one group: header (`group_code`), columns P/W/D/L/GF/GA/GD/Pts, ranked rows, `TeamFlag` per team, tabular-nums, matching existing card styling
- [x] 3.2 Render empty/"no picks yet" state when the group has zero predicted matches
- [x] 3.3 Add an all-groups wrapper that maps `simulateAllGroups` output to a responsive grid of tables (A→L order)

## 4. i18n

- [x] 4.1 Add a `groupSimulation` namespace to `messages/en.json` (heading, column labels + accessible names, empty state, "see all groups" link)
- [x] 4.2 Mirror keys in `messages/es.json` and `messages/fr.json`

## 5. Wire match detail page

- [x] 5.1 In the match detail page, when `match.stage === 'group'`, fetch sibling fixtures (`stage='group' AND group_code = match.group_code`) and the user's predictions for those `match_id`s
- [x] 5.2 Compute the single group via `simulateGroup` and render `group-standings-table` beside/below the prediction form
- [x] 5.3 Add a link from the section to the all-groups view on My Picks
- [x] 5.4 Guard: no section for anonymous users or non-group stages

## 6. Wire My Picks page

- [x] 6.1 Fetch all `stage='group'` fixtures and scope the user's predictions to those matches
- [x] 6.2 Compute via `simulateAllGroups` and render the all-groups wrapper as a new section on My Picks
- [x] 6.3 Ensure groups with no predictions still render in empty state so all groups are listed

## 7. Verification

- [x] 7.1 `pnpm test` (or project test runner) green, including new engine tests
- [x] 7.2 Typecheck/lint clean (`tsc` + eslint)
- [x] 7.3 Manual: predict across a group → standings reflect picks; edit a pick → next render updates; knockout match shows no section; anonymous visitor sees no personal table
- [x] 7.4 `openspec validate prediction-group-simulation --strict` passes
