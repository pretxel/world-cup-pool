# la-liga-fixtures

## Purpose

Defines how La Liga match fixtures and results are loaded and synced — covering the full 38-matchday season from August 2026 to May 2027.

## Requirements

### Requirement: Provider configuration loads La Liga data

The system SHALL load La Liga matches from the existing provider chain (football-data.org primary, ESPN fallback) using competition-specific provider config values.

#### Scenario: football-data.org fetches La Liga

- **WHEN** `runSync()` runs for the `la-liga-2026-2027` competition
- **THEN** it queries `https://api.football-data.org/v4/competitions/PD/matches?season=2026`
- **AND** it matches responses to local matches by home team, away team, and date

#### Scenario: ESPN fallback fetches La Liga

- **WHEN** football-data.org returns no results for the La Liga competition
- **THEN** the system falls back to `https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard`
- **AND** normalizes the response to `RemoteMatch[]`

### Requirement: Fixtures synced via existing daily cron

The daily cron sync (`/api/cron/sync-matches`) SHALL fetch La Liga fixtures and results through the same provider chain as other competitions, driven by the competition's `providers` JSONB config.

#### Scenario: Daily sync covers La Liga

- **WHEN** the daily cron runs at 09:00 UTC
- **THEN** it syncs La Liga matches alongside other competitions
- **AND** applies scores and status updates to La Liga matches

### Requirement: Season modelled as single league stage

La Liga SHALL use a single `league`-kind stage with no groups or knockout rounds. All matches have `group_code = NULL` and `stage = "regular"`.

#### Scenario: League stage match accepted

- **WHEN** a La Liga match is inserted with `stage = 'regular'` and `group_code = NULL`
- **THEN** the write succeeds
- **AND** `tie_key` and `leg` are NULL
