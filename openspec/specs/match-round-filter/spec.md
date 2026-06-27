# match-round-filter Specification

## Purpose

Adds a per-round (stage) filter to the public `/matches` list so players can narrow the day-grouped schedule to a single tournament round (group stage, Round of 32, Round of 16, …). The control mirrors the existing team and status filters: single-select, URL-encoded, read server-side, and composed onto the same visible set. Round options are derived from the rounds actually present, ordered by the competition format's stage order, and labeled with the competition's localized stage names.

## Requirements

### Requirement: Matches page offers a round filter control

The `/matches` page SHALL render a round filter control consisting of an "All rounds" option plus one selectable chip per distinct round (stage) present in the current visible schedule. The round set SHALL be derived from the fetched matches and ordered by the competition format's stage order, with each round labeled using the competition's localized stage name. When no round is selected, the "All rounds" option SHALL be shown as active.

#### Scenario: Chips reflect the rounds present

- **WHEN** a user views `/matches` and the visible schedule contains group-stage and Round-of-32 fixtures
- **THEN** the control renders a chip for the group stage and a chip for the Round of 32, in stage order
- **AND** an "All rounds" option is rendered and shown active

#### Scenario: Only present rounds appear

- **WHEN** the schedule contains no Round-of-16 fixtures in the visible set
- **THEN** no chip is rendered for the Round of 16

#### Scenario: Localized round labels

- **WHEN** the page is viewed under a supported locale
- **THEN** each round chip shows that round's name in the active locale, from the competition format

### Requirement: Selecting a round filters the match list

The round filter SHALL be single-select. When a round is selected, the day-grouped match list SHALL show only fixtures whose `stage` equals the selected round, and the header status stats SHALL be computed over the selected round. Day groups left with zero matching fixtures SHALL be hidden. Selecting "All rounds" (or re-selecting the active round) SHALL clear the filter so every visible fixture is shown.

#### Scenario: A round is selected

- **WHEN** the user selects the Round of 32 chip
- **THEN** every visible match row is a Round-of-32 fixture
- **AND** the header status stats reflect only Round-of-32 fixtures

#### Scenario: Composes with team and status filters

- **WHEN** a round is selected together with a team and/or status filter
- **THEN** the visible rows satisfy all active filters simultaneously

#### Scenario: Empty day groups hidden

- **WHEN** a round filter is active and a matchday has no fixture in the selected round
- **THEN** that matchday section is not rendered

#### Scenario: Reset to all rounds

- **WHEN** the user activates "All rounds" while a round filter is active
- **THEN** all visible fixtures are rendered and no round chip is shown active

### Requirement: Active round filter is encoded in the URL

The selected round SHALL be encoded in the URL as `?round=<stageKey>`, read server-side so the filtered view is linkable and survives reload. A `round` value that does not match any round present in the visible schedule SHALL be ignored (treated as "All rounds") rather than erroring.

#### Scenario: Selection reflected in the URL

- **WHEN** the user selects a round
- **THEN** the URL gains `?round=<stageKey>` and reloading the page preserves the selection

#### Scenario: Unknown round value ignored

- **WHEN** the page is opened with a `round` value not present in the schedule
- **THEN** no round filter is applied and the "All rounds" option is active
