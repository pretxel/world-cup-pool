# group-standings Specification

## Purpose

Defines the real, results-derived group standings for the active competition: how each tournament group's table (played / W / D / L / GF / GA / GD / points / rank) is computed exclusively from synced group-stage match results, how teams are ordered, and where the table is surfaced (a dedicated public `/standings` page). Unlike the prediction-derived `group-simulation`, these standings reflect actual outcomes, ignore every user's predictions, are identical for all visitors, and are reachable without authentication.

## Requirements

### Requirement: Standings derived only from real synced results

The system SHALL compute each tournament group's real standings exclusively from the active competition's group-stage matches whose `status = 'final'` and whose `home_score` and `away_score` are both non-null. The system SHALL NOT read any user's predictions, and SHALL NOT count `scheduled`, `live`, or `cancelled` matches, nor `final` matches with a missing score, toward points or goal aggregates.

#### Scenario: Only final results contribute
- **WHEN** a group contains one `final` match (2–1) and two `scheduled` matches
- **THEN** only the 2–1 result is reflected in the group table
- **AND** the two scheduled matches add nothing to any team's played, points, or goals

#### Scenario: Predictions are never used
- **WHEN** any visitor (signed in or anonymous) views the standings
- **THEN** no `predictions` row affects any group table
- **AND** the same table is shown to every visitor

#### Scenario: Final without a recorded score is skipped
- **WHEN** a match is marked `final` but `home_score` or `away_score` is null
- **THEN** that match contributes nothing to the table

### Requirement: Group points and goal statistics

For each group, the system SHALL accumulate, per team, across that team's counted matches: matches played, wins, draws, losses, goals for (GF), goals against (GA), goal difference (GD = GF − GA), and points awarded as **3 for a win, 1 for a draw, 0 for a loss**.

#### Scenario: Win, draw, and loss points
- **WHEN** a team's three completed group matches are one win, one draw, and one loss
- **THEN** that team's row shows played = 3, W = 1, D = 1, L = 1, and points = 4

#### Scenario: Goal aggregates and difference
- **WHEN** a team's completed matches are 2–1, 0–0, and 1–3 (from that team's perspective)
- **THEN** that team's row shows GF = 3, GA = 4, and GD = −1

#### Scenario: Both teams of a result are updated
- **WHEN** a single group match finishes home 2 – away 1
- **THEN** the home team gains a win (3 pts, GF +2, GA +1) and the away team gains a loss (0 pts, GF +1, GA +2)

### Requirement: Every group team appears even before results exist

The system SHALL seed a row for every team named in a group's fixtures, so all teams in a group appear in the table even when none of that group's matches are `final` yet. Such rows SHALL show played = 0 and all aggregates and points at 0.

#### Scenario: Pre-tournament group
- **WHEN** a group's matches are all `scheduled`
- **THEN** the table lists every team in that group at played = 0, points = 0

#### Scenario: Partway through the group stage
- **WHEN** some of a group's matches are `final` and others are not
- **THEN** the table shows accrued points for completed matches and played counts that reflect only completed matches

### Requirement: Deterministic ordering within a group

The system SHALL order teams within a group by points (descending), then goal difference (descending), then goals for (descending), then team name (ascending, case-insensitive), assigning each team a 1-based rank in that order. This ordering is a deterministic approximation and does not implement official FIFA tie-breakers (head-to-head, fair-play, drawing of lots).

#### Scenario: Higher points rank first
- **WHEN** team A has 6 points and team B has 4 points in the same group
- **THEN** team A is ranked above team B

#### Scenario: Goal difference breaks a points tie
- **WHEN** two teams have equal points
- **THEN** the team with the greater goal difference ranks higher

#### Scenario: Stable order when otherwise level
- **WHEN** two teams are equal on points, goal difference, and goals for
- **THEN** they are ordered by team name ascending, producing a stable rank

### Requirement: Dedicated public standings page

The system SHALL expose a public, locale-aware `/standings` page that renders every group's real standings table for the active competition and is reachable without authentication. The primary navigation SHALL include a link to this page.

#### Scenario: Anonymous visitor views standings
- **WHEN** an unauthenticated visitor opens `/standings`
- **THEN** the page renders the group tables computed from synced results
- **AND** no login is required

#### Scenario: Navigation entry
- **WHEN** a visitor views the primary navigation
- **THEN** a link to the standings page is present

#### Scenario: Localized rendering
- **WHEN** the page is requested under a supported locale (en, es, fr, de)
- **THEN** its headings, captions, and empty states render in that locale

### Requirement: Graceful handling when no group stage exists

When the active competition has no group stage (or no group-stage fixtures), the system SHALL render an informative empty state on the standings page instead of an error or a 404.

#### Scenario: Competition without groups
- **WHEN** the active competition's format defines no group stage
- **THEN** `/standings` renders an empty state explaining no group standings are available
- **AND** the request does not error

### Requirement: Distinct from the prediction-derived simulation

The real standings SHALL be visually and textually distinguishable from the prediction-derived `group-simulation` tables, indicating that the figures come from actual results rather than the viewer's picks.

#### Scenario: Source is labeled
- **WHEN** a real group table is rendered
- **THEN** its caption indicates the table is built from results (not from the viewer's picks)
