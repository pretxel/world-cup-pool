# la-liga-teams Specification

## Purpose

Defines the 20 La Liga clubs that participate in the 2026-2027 season, their seed data, and how they map to external provider team names for result syncing.

## ADDED Requirements

### Requirement: La Liga teams are seeded in the database

The system SHALL seed 20 La Liga club records as part of the competition seed migration. Each team SHALL have a unique name and shorthand code for display and matching.

#### Scenario: 20 clubs exist after seeding

- **WHEN** the La Liga competition seed migration runs
- **THEN** 20 team records exist associated with the `la-liga-2026-2027` competition
- **AND** each team has a `name`, `short_name`, and provider-friendly `code`

### Requirement: Team name aliases map provider names to DB names

The system SHALL include La Liga team name mappings in `team-name-aliases.ts` so that external provider responses (football-data.org, ESPN) match the seeded team names.

#### Scenario: Provider name resolves to DB name

- **WHEN** football-data.org returns `"FC Barcelona"` or `"Barcelona"`
- **THEN** the alias system resolves it to the seeded DB name `"Barcelona"`

### Requirement: 20 standard La Liga clubs

The system SHALL seed these 20 clubs for the 2026-2027 season: Alavés, Athletic Club, Atlético Madrid, Barcelona, Betis, Celta Vigo, Espanyol, Getafe, Girona, Las Palmas, Leganés, Mallorca, Osasuna, Rayo Vallecano, Real Madrid, Real Sociedad, Sevilla, Valencia, Valladolid, Villarreal.

#### Scenario: All clubs present

- **WHEN** the seed migration completes
- **THEN** all 20 named clubs exist and are associated with the La Liga competition
