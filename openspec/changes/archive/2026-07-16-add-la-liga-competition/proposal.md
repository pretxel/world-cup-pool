## Why

La Liga (Primera División) is one of the world's most-watched football leagues, featuring global clubs like Barcelona, Real Madrid, and Atlético Madrid. Adding it alongside the existing Liga MX gives the platform dual coverage of the top Spanish-speaking leagues, attracting a broad new user base and providing year-round engagement during the European season (August–May).

## What Changes

- Seed a new `competitions` row for La Liga (`kind: "custom"`) with a single league-stage format (20 teams, 38 matchdays)
- Add 20 La Liga club teams and configure external provider sync (football-data.org: `PD`, ESPN: `esp.1`) for fixtures and results
- Add team name aliases for La Liga clubs
- Verify league standings, leaderboard, and scoring work correctly with only a league stage (no knockout rounds)

## Capabilities

### New Capabilities
- `la-liga-teams`: Import and manage the 20 La Liga clubs with names, shorthand codes, and logo references
- `la-liga-fixtures`: Sync La Liga match schedule (38 matchdays, August–May) from external providers

### Modified Capabilities
- `league-phase-standings`: Add head-to-head tiebreaker support (La Liga uses H2H before goal difference, unlike Liga MX)
- `brand-identity`: La Liga color scheme, club branding in match cards

## Impact

- **DB**: One new migration to seed the La Liga competition row (no schema changes — existing infrastructure from the Liga MX change covers league formats)
- **Auth / RLS**: No changes — competition scoping is already generic
- **UI**: League standings page already supports single-table format; minimal updates for H2H tiebreaker display
- **API / Sync**: Provider config for La Liga data sources (football-data.org competition code `PD`, ESPN league path `esp.1`)
- **Scoring**: Stage multiplier config for the single league stage (×1)
