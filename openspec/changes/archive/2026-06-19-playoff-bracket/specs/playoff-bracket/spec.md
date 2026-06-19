## ADDED Requirements

### Requirement: R32 group slots resolved from current standings

The system SHALL resolve each Round-of-32 `Winner Group X` slot to group X's current rank-1 team and each `2nd Group X` slot to its current rank-2 team, using the real, results-derived standings (the same engine as `group-standings`). A group with no `final` results yet SHALL leave its slots unresolved (rendered as the original placeholder) rather than projecting a name-tiebreak "leader".

#### Scenario: Winner and runner-up projected mid-stage
- **WHEN** group X has at least one `final` result and `Winner Group X` / `2nd Group X` slots exist in R32
- **THEN** the slots show group X's current rank-1 and rank-2 teams

#### Scenario: Group with no results stays a placeholder
- **WHEN** group X has zero `final` results
- **THEN** its `Winner Group X` / `2nd Group X` slots render as the original placeholder text, not a projected team

### Requirement: Provisional vs confirmed projection status

Each standings-derived participant SHALL carry a status: **confirmed** when the source group has played all of its group matches, otherwise **provisional**. The UI SHALL visually distinguish provisional participants from confirmed ones.

#### Scenario: Provisional while group in progress
- **WHEN** group X has some but not all matches `final`
- **THEN** its projected R32 participants are marked provisional

#### Scenario: Confirmed once group complete
- **WHEN** every match in group X is `final`
- **THEN** its rank-1 / rank-2 participants are marked confirmed

### Requirement: Best-third slots resolved by official allocation when groups complete

The system SHALL resolve each `3rd Group X/Y/Z/…` slot using the competition's official best-third allocation, and SHALL do so only once all groups have completed every match (so the qualifying set of eight third-placed teams and their ordering are final). Before that, the slot SHALL render its candidate-group placeholder.

#### Scenario: Candidate placeholder before completion
- **WHEN** at least one group has an unplayed match
- **THEN** every `3rd Group …` slot renders its candidate-group placeholder, unresolved

#### Scenario: Allocated after all groups complete
- **WHEN** all 12 groups have played every match
- **THEN** each `3rd Group …` slot shows the third-placed team assigned by the official allocation for the qualifying set of groups

### Requirement: Later-round slots resolved from recorded knockout results

The system SHALL resolve `Winner Match NN` and `Loser Match NN` slots (Round of 16 through Final, including the third-place play-off) from the recorded result of the referenced fixture: the winner/loser of that fixture when it is `final` with a score. A referenced fixture that is not yet `final` SHALL leave the dependent slot as a placeholder. These slots SHALL NOT be projected from group standings.

#### Scenario: Winner advances after a final knockout result
- **WHEN** the fixture numbered NN is `final` with a decisive score
- **THEN** any `Winner Match NN` slot shows that fixture's winning team and any `Loser Match NN` slot shows its losing team

#### Scenario: Unresolved until the source match finishes
- **WHEN** the fixture numbered NN is not `final`
- **THEN** slots referencing match NN remain placeholders

### Requirement: Deterministic match numbering

The system SHALL assign FIFA match numbers to fixtures by stage order then kickoff then id, within fixed ranges: group 1–72, R32 73–88, R16 89–96, QF 97–100, SF 101–102, third-place 103, final 104. `Winner/Loser Match NN` references SHALL resolve through this numbering.

#### Scenario: Stage ranges are stable despite date overlap
- **WHEN** group and Round-of-32 fixtures share calendar dates
- **THEN** all group fixtures still number 1–72 and all R32 fixtures 73–88 (numbering is by stage order, not raw date)

### Requirement: Dedicated public bracket page

The system SHALL expose a public, locale-aware `/bracket` page that renders the full knockout bracket (Round of 32 through Final plus the third-place play-off) for the active competition, reachable without authentication, with a link in the primary navigation.

#### Scenario: Anonymous visitor views the bracket
- **WHEN** an unauthenticated visitor opens `/bracket`
- **THEN** the bracket renders with resolved participants where available and placeholders elsewhere
- **AND** no login is required

#### Scenario: Navigation entry
- **WHEN** a visitor views the primary navigation
- **THEN** a link to the bracket page is present

#### Scenario: Localized rendering
- **WHEN** the page is requested under a supported locale (en, es, fr, de)
- **THEN** its headings, round names, and status labels render in that locale

### Requirement: Graceful handling when no knockout stage exists

When the active competition has no knockout fixtures, the system SHALL render an informative empty state on the bracket page instead of an error or a 404.

#### Scenario: Competition without a knockout stage
- **WHEN** the active competition defines no knockout fixtures
- **THEN** `/bracket` renders an empty state and the request does not error
