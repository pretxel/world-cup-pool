# liga-mx-competition

## ADDED Requirements

### Requirement: Seeded Liga MX Apertura 2026 competition

The system SHALL seed a `competitions` row with `slug = 'liga-mx-apertura-2026'`, a display `name` and `short_name` for Liga MX Apertura 2026, `season = 'Apertura 2026'`, and `is_active = false`. Its `format_config` SHALL describe an ordered set of stages: a `regular` stage of `kind` `league` (groups disabled), then two-legged `qf`, `sf`, and `final` knockout stages. The stages SHALL carry point multipliers of `regular ×1`, `qf ×6`, `sf ×8`, and `final ×10`; each knockout stage SHALL declare `seedsFromStage = 'regular'`, and `sf` SHALL declare `reseedFromStage = 'qf'`.

#### Scenario: Competition row exists after seeding
- **WHEN** the seed migration runs
- **THEN** a `competitions` row with `slug = 'liga-mx-apertura-2026'` exists with `is_active = false`

#### Scenario: Format config validates
- **WHEN** the seeded `format_config` is written
- **THEN** it passes the `validate_format_config` trigger and the shared Zod schema

#### Scenario: Only one active competition preserved
- **WHEN** the Liga MX competition is seeded while the World Cup competition is active
- **THEN** the seed succeeds and the World Cup competition remains the sole active competition

### Requirement: Regular-season fixtures and Liguilla skeleton seeded

The seed SHALL create the official 17-round regular-season fixture schedule (18 teams, single round-robin) for the `regular` stage and a 14-leg Liguilla skeleton (Quarterfinals, Semifinals, Final) with placeholders that reference seeds, tie winners, and reseeded winners rather than real teams until resolved.

#### Scenario: Regular-season fixtures seeded
- **WHEN** the seed runs
- **THEN** the `regular` stage contains the full single round-robin schedule of fixtures

#### Scenario: Liguilla fixtures start as placeholders
- **WHEN** the seed runs
- **THEN** each Liguilla fixture's participants are seed or tie-winner placeholders, not real teams

### Requirement: Providers and branding configured

The seeded competition SHALL carry a `branding` block (brand code, join-code prefix, news query, email-from name) appropriate to Liga MX and a `providers` block with Football-Data `{ code: 'LMX', season: '2026' }` plus ESPN `{ leaguePath: 'mex.1' }`. The configured ESPN source SHALL remain available as the keyless fallback when the Football-Data token lacks Tier 3 Liga MX access.

#### Scenario: Branding present
- **WHEN** the competition is seeded
- **THEN** its `branding` block carries Liga-MX-appropriate values

#### Scenario: Results path defined
- **WHEN** the competition is seeded
- **THEN** its provider block configures Football-Data `LMX` and ESPN `mex.1`, with admin score entry available for recovery
