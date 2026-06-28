# playoff-bracket Specification

## Purpose

Defines the public knockout bracket for the active competition: how each slot (Round of 32 through the Final, including the third-place play-off) is resolved into a concrete team. Round-of-32 group slots are projected from the real, results-derived `group-standings`; best-third slots are filled by the competition's official best-third allocation once every group has completed; and later-round slots are resolved from recorded knockout results via deterministic FIFA match numbering. Projected participants are distinguished as provisional or confirmed, and the bracket is surfaced on a dedicated, locale-aware public `/bracket` page that degrades gracefully when no knockout stage exists.

## Requirements

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

The system SHALL resolve each `3rd Group X/Y/Z/…` slot using the competition's official best-third allocation. Once **every group has at least one result** (so each group's current third-placed team is real), the system SHALL project the slots **provisionally**: rank the current third-placed teams across all groups, take the current best eight, apply the allocation for that set, and mark each filled slot **provisional**. Once **all groups have completed every match**, the same resolution SHALL be marked **confirmed** (the qualifying set and order are final). Before every group has a result, the slot SHALL render its candidate-group placeholder.

#### Scenario: Candidate placeholder before any ranking is meaningful
- **WHEN** at least one group has no result yet
- **THEN** every `3rd Group …` slot renders its candidate-group placeholder, unresolved

#### Scenario: Provisional projection mid-stage
- **WHEN** every group has at least one result but not all groups have completed every match
- **THEN** each `3rd Group …` slot shows the third-placed team assigned by the official allocation for the current best-eight set, marked provisional

#### Scenario: Confirmed after all groups complete
- **WHEN** all 12 groups have played every match
- **THEN** each `3rd Group …` slot shows the allocated third-placed team marked confirmed

#### Scenario: Reshuffles as standings change
- **WHEN** results change which groups hold the current best-eight thirds
- **THEN** the provisional third-slot projections update accordingly

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

### Requirement: Bracket updates live when match data changes

The bracket page SHALL update its rendered bracket without a manual reload when `public.matches` changes (e.g. a knockout match finalizes). It SHALL do so by refreshing the server-rendered bracket (the server remains the single source of truth for allocation, provisional projections, and match-number resolution); the client SHALL NOT re-derive the bracket. `public.matches` SHALL be a member of the Realtime publication so changes are delivered.

#### Scenario: Knockout result advances without reload
- **WHEN** a viewer has `/bracket` open and a knockout match finalizes
- **THEN** the bracket refreshes and shows the winner advanced (and any third-place reshuffle) without the viewer reloading

#### Scenario: Debounced refresh on bursts
- **WHEN** several match rows change in quick succession (e.g. a sync run)
- **THEN** the bracket performs a single coalesced refresh rather than one per row

#### Scenario: Graceful without Realtime
- **WHEN** Realtime is unavailable or never connects
- **THEN** the bracket still renders correctly and reflects results on normal reload/navigation, with no error

### Requirement: Bracket card shows kickoff time and venue

Each rendered bracket card (Round of 32 through the Final, including the third-place play-off) SHALL display the fixture's kickoff time and its stadium (venue). The kickoff time SHALL be presented in the visitor's local timezone and locale, with a deterministic server-rendered fallback so the page hydrates without mismatch. When a fixture has no recorded venue, the card SHALL omit the venue without rendering an empty placeholder or separator. This is a presentational addition only — it SHALL NOT alter slot resolution, provisional/confirmed status, FIFA match numbering, or the live-refresh behavior.

#### Scenario: Card shows kickoff time and stadium

- **WHEN** a bracket card renders a fixture that has a kickoff time and a venue
- **THEN** the card displays the fixture's kickoff time and its stadium name

#### Scenario: Kickoff time localized to the visitor

- **WHEN** a visitor views a bracket card after the page has hydrated
- **THEN** the kickoff time is shown in the visitor's local timezone and locale
- **AND** the server-rendered output (before hydration) shows a deterministic fallback so no hydration mismatch occurs

#### Scenario: Venue omitted when unknown

- **WHEN** a bracket card renders a fixture with no recorded venue
- **THEN** the card shows the kickoff time but omits the venue, with no empty line, "null", or dangling separator

#### Scenario: Display addition does not change resolution

- **WHEN** the kickoff time and venue are added to the cards
- **THEN** the resolved participants, provisional/confirmed status, match numbering, and live-refresh behavior are unchanged

### Requirement: Bracket presents responsively with a mobile round selector

The `/bracket` page SHALL present the knockout bracket responsively. On large screens it MAY use the columnar layout (rounds as side-by-side columns). On small screens it SHALL present a **single-round selector**: a control that lists the rounds present (Round of 32 through Final, plus the third-place play-off) and shows the selected round's matches stacked vertically at full container width, such that no match content requires horizontal scrolling and no round heading or card is clipped off-screen. Switching the selected round SHALL update the shown matches without a full page navigation. The selector SHALL be keyboard-accessible (tablist semantics, roving focus, visible focus indicator) and its round labels SHALL be localized using the same round names as the columnar layout. The matches shown for a round — participants, scores, provisional/confirmed status, kickoff/venue, and live updates — SHALL be identical to those the columnar layout shows for that round.

#### Scenario: Small screens show one round without horizontal content scroll
- **WHEN** the bracket is viewed on a small (mobile) viewport
- **THEN** a round selector is shown and the selected round's matches are stacked vertically at full width
- **AND** no match card or round heading is clipped and the match content does not require horizontal scrolling

#### Scenario: Selecting a round swaps the shown matches in place
- **WHEN** a user selects a different round in the selector
- **THEN** that round's matches replace the previously shown ones without a full page navigation

#### Scenario: Large screens are unaffected
- **WHEN** the bracket is viewed on a large (desktop) viewport
- **THEN** the existing columnar layout is shown

#### Scenario: Content parity between layouts
- **WHEN** a round is shown via the mobile selector
- **THEN** its matches' participants, scores, provisional/confirmed status, kickoff/venue, and live updates match what the columnar layout shows for the same round

#### Scenario: Selector is localized and keyboard accessible
- **WHEN** the page is requested under a supported locale and a user navigates the selector by keyboard
- **THEN** the round labels render in that locale
- **AND** focus moves between rounds with a visible focus indicator
