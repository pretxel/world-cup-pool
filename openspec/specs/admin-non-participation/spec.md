# admin-non-participation Specification

## Purpose
Admin accounts are operators, not contestants. This capability keeps them out of the competition: excluded from every leaderboard (with contiguous ranks) and blocked — in the UI and on the server — from submitting predictions or quiz answers.

## Requirements
### Requirement: Admins excluded from leaderboards

Any profile with `is_admin = true` SHALL NOT appear in the overall predictions leaderboard, the per-day predictions leaderboard, or the quiz leaderboard. Rankings SHALL be computed over non-admin players only, so the displayed ranks are contiguous (1, 2, 3, …) with no gap where an admin would have placed. Standings derived from these leaderboards (e.g. the quiz standing/share) SHALL inherit the exclusion.

#### Scenario: Admin absent from the overall leaderboard

- **WHEN** an admin account has scored points and the overall leaderboard is viewed
- **THEN** the admin does not appear in the list and the remaining players are ranked 1..N with no skipped rank

#### Scenario: Admin absent from the quiz leaderboard and standing

- **WHEN** an admin has answered quiz questions and the quiz leaderboard (or a quiz share standing) is viewed
- **THEN** the admin does not appear and ranks are contiguous

#### Scenario: Non-admin ranking unchanged

- **WHEN** no admin has any score
- **THEN** the leaderboard is identical to before this change for all non-admin players

### Requirement: Admins blocked from submitting predictions

An admin SHALL NOT be able to submit or update a match prediction. In the UI, the prediction form's submit control SHALL be disabled for an admin, accompanied by a note explaining that operator accounts do not compete. The `submitPrediction` server action SHALL reject a request from an admin with an error and SHALL NOT write a prediction, regardless of the client state.

#### Scenario: Admin sees a blocked submit button

- **WHEN** an admin opens an open, confirmed match's prediction form
- **THEN** the submit button is disabled and a note states that admins do not compete

#### Scenario: Admin prediction rejected server-side

- **WHEN** an admin invokes the submit-prediction action directly (bypassing the disabled button)
- **THEN** the action returns an error and no prediction row is created or updated

#### Scenario: Non-admin submission unaffected

- **WHEN** a non-admin signed-in player submits a prediction for an open match
- **THEN** the prediction is saved as before

### Requirement: Admins blocked from answering the quiz

An admin SHALL NOT be able to submit a quiz answer. In the UI, the daily quiz answer options SHALL be disabled for an admin, accompanied by a note explaining that operator accounts do not compete. The `submitQuizAnswer` server action SHALL reject a request from an admin with an error and SHALL NOT record an answer, regardless of the client state.

#### Scenario: Admin sees blocked answer options

- **WHEN** an admin opens the daily quiz with an active question
- **THEN** the answer options are disabled and a note states that admins do not compete

#### Scenario: Admin answer rejected server-side

- **WHEN** an admin invokes the submit-quiz-answer action directly (bypassing the disabled options)
- **THEN** the action returns an error and no quiz answer is recorded

#### Scenario: Non-admin answering unaffected

- **WHEN** a non-admin signed-in player answers the daily question
- **THEN** the answer is graded and recorded as before
