# liga-mx-fixtures Specification

## Purpose

Defines how Liga MX match fixtures and results are loaded, synced, and managed — covering the regular season (Jornada 1–17) and the liguilla (quarter-finals, semi-finals, final) with two-legged aggregate ties.

## ADDED Requirements

### Requirement: Provider configuration loads Liga MX data

The system SHALL load Liga MX matches from the existing provider chain (football-data.org primary, ESPN fallback) using competition-specific provider config values.

#### Scenario: football-data.org fetches Liga MX

- **WHEN** `runSync()` runs for the `liga-mx-apertura-2026` competition
- **THEN** it queries `https://api.football-data.org/v4/competitions/LMX/matches?season=2026`
- **AND** it matches responses to local matches by home team, away team, and date

#### Scenario: ESPN fallback fetches Liga MX

- **WHEN** football-data.org returns no results for the Liga MX competition
- **THEN** the system falls back to `https://site.api.espn.com/apis/site/v2/sports/soccer/mex.liga/scoreboard`
- **AND** normalizes the response to `RemoteMatch[]`

### Requirement: Two-legged ties are supported in matches schema

The `matches` table SHALL support nullable `tie_key` and `leg` columns for knockout matches that span two legs. `tie_key` identifies the pairing (e.g., `"qf-1"`) and `leg` is `1` or `2`. World Cup matches SHALL continue to have NULL values for both.

#### Scenario: Liguilla match has tie metadata

- **WHEN** a quarter-final first leg is inserted with `stage = 'qf'`, `tie_key = 'qf-1'`, `leg = 1`
- **THEN** the second leg with the same `tie_key` and `leg = 2` is treated as the return fixture
- **AND** the bracket resolver aggregates both legs to determine the winner

#### Scenario: World Cup match has no tie data

- **WHEN** a World Cup knockout match is inserted
- **THEN** `tie_key` and `leg` are both NULL
- **AND** existing behavior is unchanged

### Requirement: Fixtures synced from external sources

The daily cron sync (`/api/cron/sync-matches`) SHALL fetch Liga MX fixtures and results through the same provider chain as World Cup, driven by the competition's `providers` JSONB config. No separate schedule or endpoint is needed.

#### Scenario: Daily sync covers Liga MX

- **WHEN** the daily cron runs at 09:00 UTC
- **THEN** it syncs both World Cup and Liga MX matches (the active competition and any competition with stale matches)
- **AND** applies scores and status updates to Liga MX matches

### Requirement: Match seeding for liguilla

The system SHALL seed the liguilla knockout matches with placeholder team names referencing league seeds, e.g., `"Seed 1"` through `"Seed 8"` for quarter-finalists, and resolve them after the regular season concludes.

#### Scenario: Quarter-final pairings use league seeds

- **WHEN** the liguilla is seeded
- **THEN** QF1 pairs Seed 1 vs Seed 8, QF2 pairs Seed 2 vs Seed 7, QF3 pairs Seed 3 vs Seed 6, QF4 pairs Seed 4 vs Seed 5
- **AND** the bracket resolver resolves `"Seed N"` placeholders from the league table position
