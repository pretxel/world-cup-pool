## Why

The `/matches` list already filters by team and by status, but as the tournament moves into the knockout stage there is no way to focus on a single round (group stage, Round of 32, Round of 16, …). With many fixtures across rounds, a player who wants to see just "the Round of 16" has to scroll. A round filter — mirroring the existing team/status controls — makes the schedule navigable by phase.

## What Changes

- Add a **round (stage) filter** control to `/matches`: an "All" option plus one chip per round present in the current schedule, labeled with the competition's localized stage names.
- Selecting a round shows only that round's fixtures; the day grouping, the header status stats, and the team/status/picks filters all operate on the selected round.
- The selection is **single-select** (one round at a time, like the status filter) and encoded in the URL (`?round=<stageKey>`) so the view is linkable and survives reload.
- Rounds are derived from the fetched matches (only rounds with fixtures appear) and ordered by the competition format's stage order. An unknown/absent `round` param is ignored (treated as "All").

## Capabilities

### New Capabilities

- `match-round-filter`: a per-round filter on the public matches list that narrows the day-grouped fixtures to a single tournament round, URL-encoded and composing with the existing team and status filters.

### Modified Capabilities

_None._ The team filter (`match-team-filter`), status filter, and visibility gate (`match-availability`) are unchanged; the round filter is an additional ephemeral filter layered on the same visible set.

## Impact

- **Code (new)**
  - `components/match-round-filter.tsx` — client chip control writing `?round=` (mirrors `match-team-filter.tsx`).
- **Code (modified)**
  - `lib/match-utils.ts` — `parseRoundParam(raw): string | null` and `stagesPresent(matches): Set<string>` (or equivalent) helpers.
  - `app/[locale]/(public)/matches/page.tsx` — build ordered round options from the active competition format (stages present in the visible set, labeled via `getStageLabel`), parse + validate the `round` param, apply the round filter into the scoped set used for stats and day grouping, render the control, and include it in the "is filtered" / empty-state logic.
- **i18n**: a filter group label and "All rounds" option label across en/es/fr/de (stage names reuse the existing competition format labels).
- **No impact** on pickability, the bracket, the scorer, or data/schema.
