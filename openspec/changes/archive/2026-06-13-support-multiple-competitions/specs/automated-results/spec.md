## ADDED Requirements

### Requirement: Result sync scopes to the active competition

Result sync SHALL resolve the active competition, load only its matches, and use a competition-scoped dedupe key so that fixtures from different competitions cannot collide on shared dates/teams.

#### Scenario: Sync loads only active-competition matches

- **WHEN** `runSync()` executes
- **THEN** it queries matches filtered by the active `competition_id`
- **AND** the dedupe key is scoped per competition

#### Scenario: Cron and manual sync need no new parameters

- **WHEN** the cron route or admin `syncNow` triggers a sync without specifying a competition
- **THEN** the sync defaults to the active competition

### Requirement: Provider URLs derive from competition config

The result providers (football-data, ESPN) SHALL build their request URLs from the active competition's `providers` JSONB rather than hardcoded World Cup endpoints. `ResultProvider.fetchMatches` SHALL accept a provider-config argument.

#### Scenario: World Cup provider URLs unchanged

- **WHEN** sync runs for `world-cup-2026`
- **THEN** the football-data and ESPN URLs resolve to the same endpoints used before the refactor

#### Scenario: Provider URL from competition config

- **WHEN** a competition supplies a different football-data code/season and ESPN league path
- **THEN** the providers build their URLs from those values
