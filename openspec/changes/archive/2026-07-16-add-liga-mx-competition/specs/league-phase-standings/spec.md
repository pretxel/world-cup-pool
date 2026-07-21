# league-phase-standings

## ADDED Requirements

### Requirement: Single-table standings for a league-kind stage

The system SHALL compute one ordered standings table for a stage whose `kind` is `league`, ranking every team that appears in that stage's matches (with `group_code` NULL) into a single table without any group partition. The table SHALL count `final` matches only and expose, per team, points, played, won, drawn, lost, goals for, goals against, and goal difference.

#### Scenario: League table built from the regular season
- **WHEN** standings are computed for the `regular` stage of a competition whose `regular` stage `kind` is `league`
- **THEN** one table is returned ranking all teams in that stage, with no group grouping

#### Scenario: Only final matches count
- **WHEN** the league table is computed while some `regular` fixtures are still `scheduled`
- **THEN** unplayed fixtures contribute nothing to any team's points, goals, or games played

### Requirement: Liga MX regular-season tiebreakers

When ordering the league table, the system SHALL apply the match-derived Liga MX regular-season order: points, then goal difference, then goals for, then goals scored as visitor, then head-to-head result. If teams remain tied after the match-derived criteria, the system SHALL require a validated official final-seeding override before confirming downstream seeds; it SHALL NOT use an arbitrary deterministic ordering to fill playoff fixtures.

#### Scenario: Goal difference breaks a points tie
- **WHEN** two teams finish level on points with different goal differences
- **THEN** the team with the better goal difference is ranked higher

#### Scenario: Away goals break a points-and-goals tie
- **WHEN** two teams are level on points, goal difference, and goals for but have different visitor-goal totals
- **THEN** the team with more visitor goals is ranked higher

#### Scenario: Head-to-head breaks a points-and-goals-and-away-goals tie
- **WHEN** two teams are level on points, goal difference, goals for, and visitor goals
- **THEN** the head-to-head result between them decides the higher rank

#### Scenario: Official override resolves non-match criteria
- **WHEN** teams remain tied after every match-derived criterion and the official Liga MX table determines their order by coefficient or Fair Play
- **THEN** an authorized admin can record the official final seeding and the resulting positions are treated as confirmed

### Requirement: Final seeding emitted for downstream rounds

Once every match in the `league` stage is `final` and every unresolved regulation tiebreak has an official override, the system SHALL emit a confirmed seeding mapping each rank position (1..N) to a team, which knockout fixtures reference by seed position. Before then the seeding SHALL be treated as provisional and SHALL NOT be written onto downstream fixtures.

#### Scenario: Seeding confirmed after the regular season completes
- **WHEN** all `regular`-stage matches are `final`
- **THEN** a confirmed 1..N seeding is available and each seed maps to a real team

#### Scenario: Provisional seeding not written downstream
- **WHEN** some `regular`-stage matches are not yet `final`
- **THEN** the seeding is provisional and no downstream fixture's participant is filled from it
