## ADDED Requirements

### Requirement: Stage labels and icons derive from the competition format

Stage display — labels, icons, and `STAGE_KEYS` — SHALL be derived from the active competition's `format_config.stages` rather than a hardcoded World Cup stage enum. A generic fallback label and icon SHALL be used for any stage not described by the format.

#### Scenario: World Cup stage labels unchanged

- **WHEN** the active competition is `world-cup-2026`
- **THEN** each stage renders the same label and icon as before the refactor

#### Scenario: Custom-format stage label

- **WHEN** the active competition defines a stage `league` with per-locale labels
- **THEN** matches in that stage render the configured label for the current locale

#### Scenario: Unknown stage falls back

- **WHEN** a match has a stage not present in the active competition's `format_config`
- **THEN** the UI renders a generic stage label and fallback icon without error
