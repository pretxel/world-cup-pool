# competition-format

## ADDED Requirements

### Requirement: Stage declarations support league-fed, reseeded playoffs

Each `format_config.stages` entry MAY declare a positive integer `pointMultiplier`, a `seedsFromStage` key, `twoLegged`, and `reseedFromStage`. `seedsFromStage` SHALL name an earlier `league` stage. `twoLegged` SHALL be permitted only on a `knockout` stage and SHALL require `seedsFromStage` so aggregate ties have a deterministic seed tiebreaker. `reseedFromStage` SHALL be permitted only on a `knockout` stage and SHALL name an earlier `knockout` stage that shares the same `seedsFromStage`.

#### Scenario: Liga MX Liguilla stages validate
- **WHEN** `regular` is a league stage and `qf`, `sf`, and `final` are two-legged knockout stages seeded from `regular`, with `sf.reseedFromStage = 'qf'`
- **THEN** the format config is accepted

#### Scenario: Invalid stage relationship rejected
- **WHEN** a stage names a missing, later, or wrong-kind stage in `seedsFromStage` or `reseedFromStage`
- **THEN** the database and shared schema reject the format config

#### Scenario: Invalid two-leg declaration rejected
- **WHEN** a non-knockout stage declares `twoLegged`, or a two-legged stage omits `seedsFromStage`
- **THEN** the database and shared schema reject the format config

### Requirement: Existing competition formats remain compatible

The new stage fields SHALL be optional. A format config that omits them SHALL retain current validation and behavior.

#### Scenario: World Cup format remains valid
- **WHEN** the existing World Cup format config is written without the new fields
- **THEN** it passes validation unchanged
