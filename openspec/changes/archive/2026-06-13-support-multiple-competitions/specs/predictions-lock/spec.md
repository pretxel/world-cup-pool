## ADDED Requirements

### Requirement: Predictions restricted to the active competition

In addition to the existing status and kickoff gates, the system SHALL reject any insert or update to a prediction whose target match does not belong to the active competition, enforced at the row-level-security layer. Cross-user reads of predictions after a match is final SHALL likewise be limited to active-competition matches.

#### Scenario: Prediction on non-active competition rejected

- **WHEN** an authenticated user submits a prediction for a match whose competition is not active
- **THEN** the database rejects the write with a row-level-security violation

#### Scenario: Prediction on active competition still follows kickoff/status gates

- **WHEN** an authenticated user submits a prediction for an active-competition match with `status = 'scheduled'` and `kickoff_at > now()`
- **THEN** the database accepts the write

#### Scenario: Switching active competition locks in-flight picks

- **WHEN** an admin switches the active competition while a user is editing a pick for the previously active competition
- **AND** the user submits that pick
- **THEN** the database rejects the write
- **AND** the UI surfaces a clear lock message after cache revalidation
