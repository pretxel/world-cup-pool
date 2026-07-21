# competition-management Specification

## MODIFIED Requirements

### Requirement: Liga MX competition is seeded as a competition

The system SHALL seed a `liga-mx-apertura-2026` competition row with appropriate `format_config`, `providers`, and `branding` values, demonstrating that adding a new competition requires no code or DDL changes beyond the seed itself.

#### Scenario: Liga MX seeded on migration

- **WHEN** a new migration runs
- **THEN** a `competitions` row with `slug = 'liga-mx-apertura-2026'` exists
- **AND** its `format_config` defines a league stage (`kind: 'league'`) and knockout stages for the liguilla (`qf`, `sf`, `final`)
- **AND** its `providers` config points at football-data.org code `LMX` and ESPN league path `mex.liga`
- **AND** its `branding` includes Liga MX-specific brand code, news query, and email from name

#### Scenario: No code change required

- **WHEN** an operator inserts a new Liga MX competition row with a valid `format_config`
- **THEN** the insert succeeds without any application code or DDL change
- **AND** the sync system processes it using the existing provider chain

### Requirement: Admin form supports league-stage competition setup

The admin competition form SHALL allow configuring league-stage competitions. The format config editor SHALL handle:
- Selecting `league` as a stage kind
- Configuring `pointMultiplier` per stage
- Adding teams associated with the competition

#### Scenario: Admin creates a league-format competition

- **WHEN** an admin opens the competition form and adds a stage with `kind: 'league'`
- **THEN** the form accepts it without requiring group configuration
- **AND** the stage shows a `pointMultiplier` field (defaulting to 1)

#### Scenario: Admin views Liga MX competition

- **WHEN** an admin opens the Liga MX competition for editing
- **THEN** the form shows all 5 tabs (Identity, Dates, Format, Providers, Branding) pre-populated with Liga MX values
- **AND** the format tab shows the league stage and liguilla knockout stages with their multipliers
