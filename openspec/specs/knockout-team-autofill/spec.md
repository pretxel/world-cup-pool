# knockout-team-autofill Specification

## Purpose

Defines an admin-triggered, idempotent action that stamps confirmed knockout participants onto fixtures by deriving them from the live bracket resolution (the same resolver as the public bracket). Placeholder knockout fixtures (e.g. "Winner Group A", "2nd Group B", "3rd Group C/E/F/H/I") become confirmed — and therefore visible and pickable under the existing `match-availability` / `predictions-lock` rules — without per-fixture manual editing. Only final (confirmed) resolutions are written, so the action confirms the Round of 32 once the group stage completes and fills later rounds on subsequent runs as their feeder matches finalize.

## Requirements

### Requirement: Admin can confirm knockout teams from standings

The system SHALL provide an admin-only action on the matches admin surface that, for the managed competition, fills each resolvable knockout fixture's `home_team` and `away_team` with the real teams derived from the live bracket resolution (the same resolver as the public bracket). The action MUST assert admin authorization and operate only on the managed competition's fixtures.

#### Scenario: Confirm the Round of 32 in one action

- **WHEN** an admin triggers "Confirm knockout teams" after the group stage has completed
- **THEN** each R32 fixture whose participants resolve to confirmed real teams has its `home_team` / `away_team` updated to those teams

#### Scenario: Non-admin cannot trigger it

- **WHEN** a non-admin attempts to invoke the action
- **THEN** the admin assertion rejects it and no fixtures are updated

### Requirement: Only confirmed resolutions are written

The action SHALL write a participant only when the bracket resolves that slot to a real team with a **confirmed** status (its source group(s) have completed). Provisional or placeholder resolutions SHALL NOT be written. Group-stage fixtures SHALL be ignored.

#### Scenario: Provisional slot left untouched

- **WHEN** a knockout slot resolves only provisionally (e.g. a best-third allocation before all groups finish)
- **THEN** that fixture side is not updated and keeps its placeholder

#### Scenario: Unresolved later round left untouched

- **WHEN** a later-round slot references a knockout match that is not yet final
- **THEN** that fixture side is not updated

#### Scenario: Confirmed slot written

- **WHEN** a slot resolves to a real team with confirmed status
- **THEN** that fixture side is updated to the resolved team

### Requirement: Action is idempotent and reports what changed

Running the action SHALL update only fixture sides whose stored value differs from a confirmed resolution, and SHALL return a summary of how many fixtures were updated. A second run with unchanged standings SHALL update nothing.

#### Scenario: Re-run is a no-op

- **WHEN** an admin runs the action twice in a row with no new results between
- **THEN** the second run updates zero fixtures and reports zero updates

#### Scenario: Summary surfaced to the admin

- **WHEN** the action completes
- **THEN** the admin sees how many fixtures were confirmed

### Requirement: Confirmed fixtures become pickable without extra steps

After the action writes both real teams onto a fixture, that fixture SHALL be treated as confirmed by the existing rules — appearing on the public matches list and accepting predictions while scheduled and before kickoff — with no separate publish or pick-open step.

#### Scenario: Confirmed R32 fixture is pickable before kickoff

- **WHEN** the action confirms an R32 fixture whose `status` is `scheduled` and whose kickoff is in the future
- **AND** a signed-in user opens its detail page
- **THEN** the prediction form is shown and a prediction is accepted

#### Scenario: Appears on the matches list

- **WHEN** the action confirms a previously-placeholder fixture
- **AND** a visitor reloads the matches list
- **THEN** the now-confirmed fixture is listed
