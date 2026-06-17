## ADDED Requirements

### Requirement: Leaderboard standings table shows a Wins column

The `/leaderboard` standings table SHALL render a "Wins" column displaying each ranked
player's winner-only hit count (`winner_hits`) — the number of predictions that landed
the correct match winner without an exact score or goal-difference match. The column SHALL
appear alongside the existing Exact and W+GD columns and SHALL follow their responsive
behavior, hidden on the narrowest viewport and shown from the small breakpoint upward. The
column header SHALL be localized in every supported locale. The shared standings component
backing the friends' group mini-board SHALL render the same column.

#### Scenario: Wins column visible on the leaderboard

- **WHEN** a visitor opens `/leaderboard` on a viewport at or above the small breakpoint
- **THEN** the standings table includes a "Wins" column header
- **AND** each player row shows that player's `winner_hits` value in the Wins cell

#### Scenario: Wins reflects winner-only hits

- **WHEN** a player has predictions scored as winner-only (1 pt each)
- **THEN** that player's Wins cell shows the count of those winner-only hits
- **AND** exact and winner+goal-difference hits are not counted in the Wins cell

#### Scenario: Wins column hidden on mobile

- **WHEN** a visitor opens `/leaderboard` on a viewport below the small breakpoint
- **THEN** the Wins column is not rendered, matching the Exact and W+GD columns

#### Scenario: Localized header

- **WHEN** the leaderboard renders in any supported locale (en, es, fr, de)
- **THEN** the Wins column header is shown in that locale's translation

#### Scenario: Group mini-board shows Wins

- **WHEN** a friends' group mini-board renders
- **THEN** it includes the Wins column for each member, sourced from `winner_hits`
