## ADDED Requirements

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
