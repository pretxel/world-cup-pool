## ADDED Requirements

### Requirement: Leaderboards scope to the active competition

The overall leaderboard view (`v_leaderboard_overall`), the per-day function (`leaderboard_for_day()`), and the per-group board SHALL include only scores for matches belonging to the active competition, via a `matches` join filtered on `active_competition_id()`. Output row shapes and function signatures SHALL remain unchanged so existing callers are untouched.

#### Scenario: Overall leaderboard excludes other competitions

- **WHEN** the database contains matches for more than one competition
- **AND** a visitor opens `/leaderboard`
- **THEN** the ranking reflects only the active competition's scores

#### Scenario: Single-competition parity

- **WHEN** only the active competition has matches (as today with World Cup 2026)
- **THEN** the leaderboard output is identical to the pre-refactor output for every user and rank

#### Scenario: Group board scopes to its own competition

- **WHEN** a friend group's mini-board renders
- **THEN** it ranks members using only scores from the group's competition
