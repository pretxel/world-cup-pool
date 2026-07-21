# competition-format Specification

## MODIFIED Requirements

### Requirement: Per-competition format configuration

Each competition SHALL define its format in a `format_config` JSONB value containing an ordered `stages` array (each stage with `key`, `kind` of `group|knockout|league`, `order`, per-locale `labels`, `icon`, `hasGroupCode`, `revealed`, and optional `pointMultiplier`) and a `groups` object (`enabled`, and when enabled `pattern` and `count`).

#### Scenario: Group-and-knockout format (World Cup / Euro / Libertadores)

- **WHEN** a competition defines group stages plus knockout rounds with `groups.enabled = true` and a group `pattern`
- **THEN** matches in group stages accept a matching `group_code` and knockout matches accept a NULL `group_code`

#### Scenario: Single league-phase format (Champions League / Liga MX / La Liga)

- **WHEN** a competition defines a single stage `{ key: 'regular', kind: 'league', hasGroupCode: false }` with `groups.enabled = false`
- **THEN** its matches are accepted with `group_code` NULL and no group stage is required

### Requirement: Match stage and group code validated against the competition

The system SHALL validate every `matches` insert/update with a `BEFORE INSERT/UPDATE` trigger that checks `stage` against the match's competition `format_config.stages[].key`, and `group_code` against the competition's group `pattern` (requiring NULL when the stage is non-group or groups are disabled).

#### Scenario: Valid La Liga stage accepted

- **WHEN** a match for `la-liga-2026-2027` is written with `stage = 'regular'` and `group_code = NULL`
- **THEN** the write succeeds

#### Scenario: Unknown stage rejected

- **WHEN** a match is written with a `stage` not present in its competition's `format_config.stages`
- **THEN** the trigger rejects the write
