## ADDED Requirements

### Requirement: Leaderboard standings table shows at most the top 10

The `/leaderboard` standings table SHALL render at most the top 10 ranked players (ranks 1 through 10) from `v_leaderboard_overall`. When fewer than 10 players exist, all of them SHALL be shown. The cap applies only to the rows passed to the standings table; the leader card, the total player count, and a signed-in user's own standing SHALL continue to reflect the full ranked field.

#### Scenario: More than 10 players
- **WHEN** the ranked field contains more than 10 players
- **AND** a visitor opens `/leaderboard`
- **THEN** the standings table renders exactly 10 rows, ranks 1 through 10 in order
- **AND** no 11th-or-lower row appears in the table

#### Scenario: Ten or fewer players
- **WHEN** the ranked field contains 10 or fewer players
- **AND** a visitor opens `/leaderboard`
- **THEN** the standings table renders every player

#### Scenario: Leader card and total count reflect the full field
- **WHEN** the ranked field contains more than 10 players
- **AND** a visitor opens `/leaderboard`
- **THEN** the leader card shows the rank-1 player
- **AND** the leader stat reports the full player count (not 10)

#### Scenario: Signed-in user ranked outside the top 10
- **WHEN** a signed-in user is ranked 11th or lower
- **AND** that user opens `/leaderboard`
- **THEN** the user does not appear in the top-10 standings table
- **AND** the "share your rank" section still shows that user's actual rank and points
