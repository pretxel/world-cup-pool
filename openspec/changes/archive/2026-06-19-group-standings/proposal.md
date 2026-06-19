## Why

The app syncs real match results from ESPN into `public.matches`, but there is nowhere to see the **actual** group-stage tables those results produce. The only group standings today are the personal "what if my picks came true" simulation (`group-simulation`), which deliberately ignores real results. Fans following the tournament have no neutral, factual view of who is topping each group and who is going through.

## What Changes

- Add a dedicated, public `/standings` page that renders all tournament groups as real standings tables (Played / W / D / L / GF / GA / GD / Pts / rank), computed from finished group-stage match results synced from ESPN.
- Add a server data loader that reads group-stage matches for the active competition and builds each group's table from `final` results only (in-progress and scheduled matches contribute nothing to points yet).
- Reuse the existing standings math engine (`simulateGroup` in `lib/group-standings.ts`, the standard 3/1/0 football-points calculator) by feeding it real scorelines instead of predicted ones — no second copy of the table logic.
- Generalize the presentational `GroupStandingsTable` component so its labels/empty-state can describe a results-derived table ("from results") as well as the existing picks-derived one ("from your picks"), without forking the markup.
- Add a top-level nav entry linking to `/standings`.
- Add a new `groupStandings` i18n namespace (en/es/fr/de) for the page, headings, and empty states.

## Capabilities

### New Capabilities
- `group-standings`: A public, results-derived view of every tournament group's real standings table, computed on read from synced `final` match scores for the active competition, surfaced on a dedicated `/standings` page and linked from the primary navigation.

### Modified Capabilities
<!-- None. group-simulation (predicted tables) is unchanged; the shared presentational component is generalized at the implementation level only, not at the spec/requirement level. -->

## Impact

- **New route**: `app/[locale]/(public)/standings/page.tsx` (+ `loading.tsx`).
- **New lib**: a results-table loader (e.g. `lib/group-table.ts`) that selects group-stage matches and reuses `simulateGroup`/`simulateAllGroups`.
- **Component**: `components/group-standings-table.tsx` gains a source/variant prop so headings, the "from …" caption, and the empty state are configurable; existing call sites (match detail, My Picks) keep their current copy via defaults.
- **Navigation**: `components/site-nav.tsx` / `site-nav-client.tsx` add a Standings link.
- **i18n**: new `groupStandings` namespace in `messages/{en,es,fr,de}.json`.
- **Data source**: depends on the existing ESPN/Football-Data sync (`automated-results`) keeping `matches.home_score`/`away_score`/`status` current; no new external calls.
- No schema changes, no new dependencies.
