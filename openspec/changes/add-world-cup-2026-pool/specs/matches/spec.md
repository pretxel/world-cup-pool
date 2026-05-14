## ADDED Requirements

### Requirement: Match catalog
The system SHALL store a record per FIFA World Cup 2026 match in a `matches` table, including stage, optional group code, home team, away team, kickoff timestamp (UTC), venue, status, and nullable final score, and SHALL expose the catalog as a publicly readable list.

#### Scenario: Anonymous visitor lists matches
- **WHEN** any visitor (signed-in or not) loads the matches page
- **THEN** the system returns all matches ordered by `kickoff_at` ascending, with home/away team, kickoff time, stage, status, and final score (or null when not entered).

#### Scenario: Match groups by tournament day
- **WHEN** a visitor opens the daily view for a given calendar day in their timezone
- **THEN** the system returns only matches whose `kickoff_at`, converted to that timezone, falls on that day.

### Requirement: Admin manages fixtures
The system SHALL allow users with `is_admin = true` to create, edit, and delete matches; non-admins and the unauthenticated SHALL be denied.

#### Scenario: Admin creates a match
- **WHEN** an admin submits a new match with stage, home/away teams, kickoff timestamp, and optional group code
- **THEN** the system inserts a row into `matches` with `status='scheduled'` and `home_score`/`away_score` null.

#### Scenario: Admin edits kickoff time before kickoff
- **WHEN** an admin updates `kickoff_at` for a match whose previous `kickoff_at` is still in the future
- **THEN** the system saves the new value and predictions for that match remain editable until the new kickoff time.

#### Scenario: Non-admin denied fixture write
- **WHEN** a non-admin (or unauthenticated client) attempts to insert, update, or delete a row in `matches`
- **THEN** Supabase RLS rejects the write and the API surface returns an authorization error.

### Requirement: Admin enters final score
The system SHALL allow an admin to set `home_score`, `away_score`, and `status='final'` for a match, and SHALL automatically (re)compute prediction scores for that match when those columns change.

#### Scenario: Admin enters a result
- **WHEN** an admin submits a final score for a match
- **THEN** the system updates `matches.home_score`, `matches.away_score`, sets `status='final'`, and triggers `compute_match_scores(match_id)`.

#### Scenario: Admin corrects a previously entered result
- **WHEN** an admin edits the final score of a match that already has `status='final'`
- **THEN** the system updates the score and re-runs `compute_match_scores(match_id)`, replacing any previous rows in `scores` for that match.

#### Scenario: Admin invalidates result
- **WHEN** an admin clears a final score (sets `home_score`/`away_score` back to null) or sets `status='cancelled'`
- **THEN** the system deletes the corresponding rows in `scores` so the match no longer contributes to the leaderboard.
