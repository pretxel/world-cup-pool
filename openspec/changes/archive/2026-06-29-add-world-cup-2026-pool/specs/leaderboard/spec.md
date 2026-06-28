## ADDED Requirements

### Requirement: Overall leaderboard
The system SHALL expose an overall leaderboard ranking all users by their total points across every `status='final'` match, displayed on a publicly readable page.

#### Scenario: Overall ranking ordering
- **WHEN** a visitor opens the overall leaderboard page
- **THEN** the system returns one row per user (only users with at least one `scores` row), ordered by `total_points` descending, including `display_name`, `total_points`, `exact_hits`, and `winner_gd_hits`.

#### Scenario: User with no scored matches absent
- **WHEN** a user has signed up but has no rows in `scores` (no predictions on any final match)
- **THEN** the system omits that user from the overall leaderboard.

### Requirement: Daily leaderboard
The system SHALL expose a daily leaderboard scoped to a single calendar day, resolved in the viewing user's timezone, defaulting to "today" on the user's first visit.

#### Scenario: Default to today
- **WHEN** a visitor opens the leaderboard page without specifying a date
- **THEN** the system resolves "today" using the visitor's browser timezone and returns only points earned on matches whose `kickoff_at` falls on that day in that timezone.

#### Scenario: Browse a past tournament day
- **WHEN** a visitor selects a specific past day from the leaderboard date picker
- **THEN** the system returns rankings computed only from matches whose `kickoff_at` falls on that day, with the same columns as the overall view.

#### Scenario: Day with no final matches
- **WHEN** the selected day has no matches with `status='final'`
- **THEN** the system renders an empty state with the message "No completed matches on this day" and does not list any users.

### Requirement: Tie-breakers
The system SHALL break ties between users with equal `total_points` using, in order: (1) more exact-score hits, (2) more correct-winner-with-goal-difference hits, (3) earlier `submitted_at` of the user's most recent counted prediction.

#### Scenario: Tie broken by exact hits
- **WHEN** two users have equal `total_points` but one has more `hit_type='exact'` rows in the relevant scope
- **THEN** the user with more exact hits ranks higher.

#### Scenario: Tie broken by winner+gd hits
- **WHEN** two users tie on points and exact hits but differ on `winner_gd` count
- **THEN** the user with more `winner_gd` hits ranks higher.

#### Scenario: Tie broken by submission timestamp
- **WHEN** two users are tied on points, exact hits, and `winner_gd` hits
- **THEN** the user whose latest counted prediction has the earlier `submitted_at` ranks higher.

### Requirement: Live freshness after admin updates
The system SHALL invalidate the cached leaderboard within a request of the admin entering or correcting a result so the next visitor sees the recomputed ranking.

#### Scenario: Cache invalidated after admin entry
- **WHEN** an admin saves a final score that successfully runs `compute_match_scores`
- **THEN** the server action calls `revalidateTag('leaderboard')` and a subsequent request returns the updated standings.

#### Scenario: Visible without forced reload
- **WHEN** a visitor on the leaderboard page navigates away and returns (or refreshes) after a tagged invalidation
- **THEN** the page reflects the new standings without requiring a hard reload or cache busting.

### Requirement: Personal ranking context
The system SHALL surface the signed-in user's own rank and points on the leaderboard view in addition to the listing of all users.

#### Scenario: Signed-in user sees own rank
- **WHEN** an authenticated user opens any leaderboard view (overall or daily)
- **THEN** the system highlights or summarises that user's row showing their current rank, total points in scope, and total participant count.

#### Scenario: Unranked user
- **WHEN** an authenticated user has not yet earned points in the selected scope
- **THEN** the system shows "Not yet ranked" with a 0-point summary instead of a rank number.
