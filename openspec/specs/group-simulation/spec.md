# group-simulation Specification

## Purpose

Defines a personal, prediction-derived group standings view: how each tournament group's table (played / W / D / L / GF / GA / GD / points / rank) is computed from a signed-in user's predicted group-stage scorelines, which matches contribute, how teams are ordered, and where the table is surfaced (match detail page + My Picks). The simulation is a "what if my picks came true" toy — computed on read, persisted nowhere, never shown to other users, and never folded into competitive scoring or the leaderboard.
## Requirements
### Requirement: Standings derived only from the user's own predictions

The system SHALL compute each tournament group's simulated standings exclusively from the signed-in user's predicted scorelines for `stage = 'group'` matches. The system SHALL NOT read another user's predictions, and SHALL NOT fold actual match results (`home_score` / `away_score`) into the simulated table.

#### Scenario: Only the caller's predictions are used
- **WHEN** a signed-in user views a simulated group table
- **THEN** every counted fixture's scoreline comes from that user's own `predictions` row for the match
- **AND** no other user's predictions affect the table

#### Scenario: Real results are ignored
- **WHEN** a group match is `final` with an actual result, and the user predicted a different scoreline
- **THEN** the simulated table uses the user's predicted scoreline, not the actual result

#### Scenario: Anonymous visitor sees no personal simulation
- **WHEN** a request without an authenticated session reaches a surface that shows the simulation
- **THEN** the system renders no personalized standings for that visitor

### Requirement: Group points and goal statistics

For each group, the system SHALL accumulate, per team, across that team's counted group matches: matches played, wins, draws, losses, goals for (GF), goals against (GA), goal difference (GD = GF − GA), and points awarded as **3 for a win, 1 for a draw, 0 for a loss**.

#### Scenario: Win, draw, and loss points
- **WHEN** a user predicts a team's three group matches as one win, one draw, and one loss
- **THEN** that team's row shows played = 3, W = 1, D = 1, L = 1, and points = 4

#### Scenario: Goal aggregates and difference
- **WHEN** a user predicts a team's matches as 2–1, 0–0, and 1–3
- **THEN** that team's row shows GF = 3, GA = 4, and GD = −1

#### Scenario: Both teams of a predicted match are updated
- **WHEN** a user predicts a single group match as home 2 – away 1
- **THEN** the home team gains a win (3 pts, GF +2, GA +1) and the away team gains a loss (0 pts, GF +1, GA +2) in their group rows

### Requirement: Tie-break ordering within a group

The system SHALL order the teams in each group by, in priority: points descending, then goal difference descending, then goals for descending, then team name ascending (A–Z, case-insensitive). The system SHALL assign each team a rank reflecting this order, starting at 1.

#### Scenario: Points decide first
- **WHEN** two teams have 6 and 4 points respectively
- **THEN** the 6-point team is ranked above the 4-point team regardless of goal stats

#### Scenario: Goal difference breaks a points tie
- **WHEN** two teams have equal points but goal differences of +3 and +1
- **THEN** the +3 team ranks above the +1 team

#### Scenario: Goals for breaks a points-and-GD tie
- **WHEN** two teams have equal points and equal goal difference but goals-for of 7 and 5
- **THEN** the team with 7 goals-for ranks above the team with 5

#### Scenario: Team name breaks a fully equal tie
- **WHEN** two teams are equal on points, goal difference, and goals-for
- **THEN** the system orders them by team name ascending so the ordering is stable and deterministic

### Requirement: Unpredicted matches are skipped

The system SHALL count a group match toward the standings only when the user has a prediction for it. A group match with no prediction from the user SHALL contribute nothing — no played count, no points, no goals — to either team. A team's played count SHALL therefore equal the number of its group matches the user has predicted (0 to 3).

#### Scenario: Match with no prediction is excluded
- **WHEN** a group has six fixtures and the user has predicted only two of them
- **THEN** only those two predicted fixtures contribute to the table
- **AND** the four unpredicted fixtures add no played count, points, or goals to any team

#### Scenario: Partially predicted team
- **WHEN** a team has played three group matches in the schedule but the user predicted only one of them
- **THEN** that team's row shows played = 1, reflecting only the predicted match

#### Scenario: Group with zero predictions
- **WHEN** the user has predicted none of a group's matches
- **THEN** every team in that group shows played = 0 and points = 0
- **AND** the group renders an empty/"no picks yet" state rather than a fabricated table

### Requirement: Simulated table on the match detail page

On a group-stage match's detail page, the system SHALL render a simulated standings section for that match's group (`group_code`), built from the viewing user's predictions for the group's fixtures, positioned with the prediction form. The section SHALL provide a link to the full all-groups view.

#### Scenario: Group table accompanies the prediction form
- **WHEN** a signed-in user opens a group-stage match's detail page
- **THEN** the page shows the simulated standings for that match's group alongside the prediction form

#### Scenario: New pick is reflected on next read
- **WHEN** the user submits or updates a prediction for a match and the group standings are recomputed on the next render
- **THEN** the simulated table reflects the updated scoreline

#### Scenario: Knockout match shows no group table
- **WHEN** a user opens a match whose `stage` is not `group`
- **THEN** no simulated group standings section is shown for that match

#### Scenario: Link to all groups
- **WHEN** the simulated group section renders on a match detail page
- **THEN** it offers a link to the full all-groups simulation on My Picks

### Requirement: All twelve simulated groups on My Picks

On the My Picks page, the system SHALL render every tournament group's simulated table, each built from the viewing user's group-stage predictions, presented together so the user can scan all groups at once.

#### Scenario: All groups rendered together
- **WHEN** a signed-in user opens My Picks
- **THEN** the page renders a simulated standings table for each group that exists in the schedule
- **AND** each table is computed from that user's predictions for its group's fixtures

#### Scenario: Groups with no predictions still listed
- **WHEN** the user has predicted some groups' matches but not others
- **THEN** predicted groups show populated tables and unpredicted groups show an empty/"no picks yet" state, so the set of groups is complete

### Requirement: Simulation is personal and ephemeral

The simulated standings SHALL be computed on read and persisted nowhere. The system SHALL NOT store, expose, or rank users by simulated standings, and SHALL NOT show one user's simulation to another user. The simulation SHALL NOT affect scoring, the leaderboard, or any group mini-board.

#### Scenario: No persistence
- **WHEN** the simulated standings are produced for a page render
- **THEN** the system writes no row representing the standings and derives them fresh on each request

#### Scenario: Not part of competitive scoring
- **WHEN** the simulation is displayed
- **THEN** it does not change the user's `scores`, total points, or any leaderboard position

### Requirement: Group standings render only for competitions with a group stage

Group standings and simulation SHALL render only when the active competition has a group stage (`groups.enabled = true`), and SHALL key the group-stage query off the competition's group-stage key instead of the literal `'group'`.

#### Scenario: World Cup shows group standings

- **WHEN** the active competition is `world-cup-2026`
- **THEN** group standings render using the competition's group-stage key

#### Scenario: League-only competition hides group standings

- **WHEN** the active competition has `groups.enabled = false`
- **THEN** no group standings or simulation UI is rendered

