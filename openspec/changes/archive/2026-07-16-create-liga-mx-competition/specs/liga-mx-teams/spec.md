# liga-mx-teams Specification

## Purpose

Defines the 18 Liga MX clubs that participate in the Apertura 2026 tournament, their seed data in the database, and how they map to external provider team names for result syncing.

## ADDED Requirements

### Requirement: Liga MX teams are seeded in the database

The system SHALL seed 18 Liga MX club records as part of the competition seed migration. Each team SHALL have a unique name and shorthand code for display and matching.

#### Scenario: 18 clubs exist after seeding

- **WHEN** the Liga MX competition seed migration runs
- **THEN** 18 team records exist in the `teams` table (or equivalent competition-agnostic team storage) associated with the `liga-mx-apertura-2026` competition
- **AND** each team has a `name`, `short_name`, and provider-friendly `code`

### Requirement: Team name aliases map provider names to DB names

The system SHALL include Liga MX team name mappings in `team-name-aliases.ts` so that external provider responses (football-data.org, ESPN) match the seeded team names.

#### Scenario: Provider name resolves to DB name

- **WHEN** football-data.org returns `"Club América"` or `"Club America"`
- **THEN** the alias system resolves it to the seeded DB name `"América"`
- **AND** the sync system applies the result to the correct local match

### Requirement: 18 standard Liga MX clubs

The system SHALL seed these 18 clubs for the Apertura 2026 season: América, Atlas, Atlético San Luis, Cruz Azul, FC Juárez, Guadalajara, León, Mazatlán, Monterrey, Necaxa, Pachuca, Puebla, Querétaro, Santos Laguna, Tijuana, Toluca, UANL (Tigres), UNAM (Pumas).

#### Scenario: All clubs present

- **WHEN** the seed migration completes
- **THEN** all 18 named clubs exist and are associated with the Liga MX competition
