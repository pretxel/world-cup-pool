# scoring

## Purpose

Deterministic points calculation per prediction against a final match score, persisted in the `scores` table and recomputed idempotently whenever an admin sets, edits, or clears a final score.

## Requirements

### Requirement: Deterministic scoring rules
The system SHALL award points per prediction against a final match score using exactly these rules, and SHALL persist the result in the `scores` table with the matching `hit_type` value:

- **5 points / `exact`**: both `home_goals` and `away_goals` equal the match's final scores.
- **3 points / `winner_gd`**: the prediction picks the correct winner (or correct draw) AND has the same goal difference (`home_goals - away_goals`) as the actual result, but does not match the exact scoreline.
- **1 point / `winner`**: the prediction picks the correct winner (or correct draw) but does not match goal difference.
- **0 points / `miss`**: none of the above.

#### Scenario: Exact score
- **WHEN** a user predicted 2-1 and the final result is 2-1
- **THEN** the system records `points = 5` and `hit_type = 'exact'` in `scores` for that `(user_id, match_id)`.

#### Scenario: Correct winner and goal difference
- **WHEN** a user predicted 2-1 and the final result is 3-2
- **THEN** the system records `points = 3` and `hit_type = 'winner_gd'`.

#### Scenario: Correct draw with different score
- **WHEN** a user predicted 1-1 and the final result is 2-2
- **THEN** the system records `points = 3` and `hit_type = 'winner_gd'` (draw with matching goal difference of 0).

#### Scenario: Correct winner only
- **WHEN** a user predicted 2-0 and the final result is 3-1
- **THEN** the system records `points = 1` and `hit_type = 'winner'`.

#### Scenario: Wrong winner
- **WHEN** a user predicted 2-1 and the final result is 1-2
- **THEN** the system records `points = 0` and `hit_type = 'miss'`.

### Requirement: Recompute on result change
The system SHALL recompute `scores` for a match whenever an admin sets, edits, or clears its final score, and the recompute SHALL be idempotent — running it twice on the same final score produces identical rows.

#### Scenario: Recompute fires on score insert
- **WHEN** an admin sets a final score on a match for the first time
- **THEN** the system runs `compute_match_scores(match_id)` which inserts one `scores` row per `predictions` row for that match.

#### Scenario: Recompute fires on score correction
- **WHEN** an admin edits the final score of a match that already has rows in `scores`
- **THEN** the system deletes the existing `scores` rows for that match and re-inserts based on the new result.

#### Scenario: Recompute on cancellation
- **WHEN** an admin sets a match's `status` to `'cancelled'` or nulls out its final score
- **THEN** the system removes all `scores` rows for that match so it no longer affects the leaderboard.

#### Scenario: Idempotent recompute
- **WHEN** `compute_match_scores(match_id)` is invoked a second time with no other changes
- **THEN** the rows in `scores` for that match are identical to the first invocation.

### Requirement: Predictions without scores
The system SHALL NOT create `scores` rows for matches whose `status` is not `'final'`, even if predictions exist.

#### Scenario: Match not yet final
- **WHEN** a match has predictions but `status != 'final'`
- **THEN** the `scores` table contains no rows for that match and the leaderboard treats those predictions as awarding 0 points until the result is entered.
