## ADDED Requirements

### Requirement: Submit prediction per match
The system SHALL allow each authenticated user to submit exactly one exact-score prediction per match, consisting of non-negative integer `home_goals` and `away_goals` values between 0 and 20 inclusive.

#### Scenario: First prediction for a match
- **WHEN** an authenticated user submits a prediction for a match whose `kickoff_at` is in the future and they have no existing prediction for it
- **THEN** the system inserts a row into `predictions` with `user_id = auth.uid()`, the provided `home_goals` and `away_goals`, and `submitted_at = now()`.

#### Scenario: Update existing prediction before kickoff
- **WHEN** an authenticated user changes their prediction for a match whose `kickoff_at` is still in the future
- **THEN** the system updates `home_goals`/`away_goals` on the existing row and refreshes `submitted_at` to `now()`.

#### Scenario: Rejection of out-of-range goals
- **WHEN** a user submits a prediction with `home_goals` or `away_goals` less than 0 or greater than 20
- **THEN** the system rejects the submission with a validation error and does not modify the database.

#### Scenario: Uniqueness per user/match
- **WHEN** a user attempts to insert a second prediction row for the same `(user_id, match_id)` pair
- **THEN** the database unique constraint causes the insert to fail and the application returns the error as an update instead.

### Requirement: Predictions locked at kickoff
The system SHALL refuse any prediction insert or update for a match whose `kickoff_at` is at or before the current time, enforced by Supabase Row-Level Security so the database itself rejects late writes regardless of UI state.

#### Scenario: Submit after kickoff
- **WHEN** an authenticated user attempts to insert a prediction for a match where `kickoff_at <= now()`
- **THEN** the RLS policy denies the insert and the system returns a "Predictions are locked" error.

#### Scenario: Edit after kickoff
- **WHEN** an authenticated user attempts to update an existing prediction for a match where `kickoff_at <= now()`
- **THEN** the RLS policy denies the update, the previous prediction value is preserved, and the system returns a "Predictions are locked" error.

#### Scenario: UI disables form at kickoff
- **WHEN** a user has the prediction form open and the countdown reaches kickoff
- **THEN** the form transitions to a read-only state showing their current prediction and the message "Locked at kickoff".

### Requirement: User-owned reads
The system SHALL allow each authenticated user to read their own predictions, and SHALL hide other users' specific predictions until after the relevant match's `status='final'` (or until the user has also submitted for that match, at the implementer's discretion to discourage copying).

#### Scenario: User views own predictions
- **WHEN** an authenticated user navigates to "My picks"
- **THEN** the system returns all rows from `predictions` where `user_id = auth.uid()` joined with the corresponding `matches` rows.

#### Scenario: Other users' picks hidden before kickoff
- **WHEN** any user views a match whose `kickoff_at` is in the future
- **THEN** the system does not reveal other users' `home_goals`/`away_goals` values for that match in any API response.

#### Scenario: Other users' picks visible after match final
- **WHEN** any visitor views a match where `matches.status = 'final'`
- **THEN** the system MAY show all submitted predictions for that match alongside the actual result.
