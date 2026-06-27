## ADDED Requirements

### Requirement: Admin can reveal or hide a knockout round

The system SHALL let an admin toggle a *revealed* flag for each knockout stage of the managed competition. The flag SHALL be stored in the competition format (per stage) and default to hidden. The toggle action MUST assert admin authorization and operate on the managed competition. Group and league stages SHALL NOT be revealable (only `kind = "knockout"`).

#### Scenario: Reveal a round

- **WHEN** an admin toggles a knockout stage (e.g. Round of 32) to revealed for the managed competition
- **THEN** that stage's `revealed` flag is persisted in the competition format

#### Scenario: Hide a previously revealed round

- **WHEN** an admin toggles a revealed knockout stage back to hidden
- **THEN** the flag is cleared and that round's unconfirmed fixtures stop appearing on the public list

#### Scenario: Non-admin cannot toggle

- **WHEN** a non-admin attempts to invoke the toggle
- **THEN** the action is rejected and no flag changes

#### Scenario: Default hidden

- **WHEN** a competition format has no explicit reveal flag for a knockout stage
- **THEN** that round is treated as hidden

### Requirement: Revealed rounds surface their fixtures read-only on the public list

When a knockout round is revealed, the public `/matches` list SHALL include that round's fixtures even when their participants are still placeholders, rendered as read-only schedule rows (showing date, venue, stage, and the placeholder participant text) with no prediction affordance.

#### Scenario: Revealed placeholder fixture is listed read-only

- **WHEN** a round is revealed and a visitor opens `/matches`
- **THEN** that round's placeholder fixtures appear with their schedule
- **AND** no "Pick" control is shown for an unconfirmed fixture

#### Scenario: Hidden round stays invisible

- **WHEN** a knockout round is not revealed and its fixtures are unconfirmed
- **THEN** those fixtures do not appear on `/matches`

### Requirement: Revealing a round does not change pickability

Revealing a round SHALL NOT make its unconfirmed fixtures pickable. Pickability SHALL remain gated solely on the existing rules — the fixture's teams must be confirmed (both real countries), its `status` `scheduled`, and its kickoff in the future. A confirmed fixture SHALL be pickable whether or not its round's reveal flag is set.

#### Scenario: Revealed but unconfirmed is not pickable

- **WHEN** a revealed fixture still has a placeholder participant
- **AND** a signed-in user opens its detail page
- **THEN** the "teams not confirmed yet" state is shown and no prediction form is rendered

#### Scenario: Confirmed fixture pickable regardless of reveal flag

- **WHEN** a fixture's teams are confirmed, it is scheduled, and its kickoff is in the future
- **THEN** it is pickable, independent of its round's reveal flag
