# competition-format Specification

## MODIFIED Requirements

### Requirement: Per-competition format configuration

Each competition SHALL define its format in a `format_config` JSONB value containing an ordered `stages` array (each stage with `key`, `kind` of `group|knockout|league`, `order`, per-locale `labels`, `icon`, `hasGroupCode`, `revealed`, and optional `pointMultiplier`) and a `groups` object (`enabled`, and when enabled `pattern` and `count`).

#### Scenario: Group-and-knockout format (World Cup / Euro / Libertadores)

- **WHEN** a competition defines group stages plus knockout rounds with `groups.enabled = true` and a group `pattern`
- **THEN** matches in group stages accept a matching `group_code` and knockout matches accept a NULL `group_code`

#### Scenario: Single league-phase format (Champions League)

- **WHEN** a competition defines a single stage `{ key: 'league', kind: 'league', hasGroupCode: false }` with `groups.enabled = false`
- **THEN** its matches are accepted with `group_code` NULL and no group stage is required

#### Scenario: League + knockout format (Liga MX)

- **WHEN** a competition defines a league stage followed by knockout stages with `groups.enabled = false`
- **THEN** league-stage matches have `group_code = NULL`
- **AND** knockout-stage matches have `group_code = NULL`
- **AND** knockout stage `key` values are validated against `format_config.stages`

### Requirement: Format config is validated on write

The system SHALL reject a `competitions` row whose `format_config` is malformed — an empty `stages` array, duplicate stage keys, an invalid `groups` object, or a `pointMultiplier` that is not a positive number SHALL fail at write time via a validation trigger on `competitions`.

#### Scenario: Malformed format rejected

- **WHEN** a competition is written with a `format_config` that has duplicate stage keys, an empty `stages` array, or a zero/negative `pointMultiplier`
- **THEN** the database rejects the write

#### Scenario: Point multiplier accepted

- **WHEN** a competition is written with `format_config` stages that include valid positive `pointMultiplier` values
- **THEN** the write succeeds
