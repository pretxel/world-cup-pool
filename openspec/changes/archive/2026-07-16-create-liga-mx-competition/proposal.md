## Why

The app currently only supports World Cup 2026. Adding Liga MX (Mexico's top-flight league) expands the platform to cover North America's most-watched domestic football competition, attracting a new user base and providing year-round engagement between World Cup cycles.

## What Changes

- Seed a new `competitions` row for Liga MX (`kind: "custom"`) with Apertura 2026 + Clausura 2027 format config
- Add 18 Liga MX club teams and configure external provider sync (football-data.org + ESPN) for fixtures and results
- Introduce a league standings table view (single table, no groups) alongside the existing group standings
- Wire competition-specific stage scoring multipliers for the league stage
- Verify all existing views (matches, leaderboard, bracket, standings) handle a league-format competition gracefully

## Capabilities

### New Capabilities
- `liga-mx-teams`: Import and manage the 18 Liga MX clubs with names, shorthand codes, and logo references
- `liga-mx-fixtures`: Sync Liga MX match schedule (Jornada 1–17 + liguilla) from external providers

### Modified Capabilities
- `standings`: Add a league table component (single standings table sorted by points/GD/GF) for league-format stages, surfaced on the existing `/standings` page
- `competition-format`: Validate league-format format_config in the competition form (league stages with groups disabled, default stage multiplier config)
- `competition-management`: Admin form updates to support league-stage competition setup (teams management, fixture sync configuration)

## Impact

- **DB**: One new migration to seed the Liga MX competition row (no schema changes — existing `competitions` table is already generic)
- **Auth / RLS**: No changes — competition scoping is already generic
- **UI**: League standings component and league-format adaption in match list views
- **API / Sync**: Provider config for Liga MX data sources (football-data.org competition code `LMX`, ESPN league ID `[TBD]`)
- **Scoring**: Stage multiplier config for league + knockout stages
