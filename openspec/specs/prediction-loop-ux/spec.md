# prediction-loop-ux Specification

## Purpose

Defines the UX/UI quality criteria the core prediction-loop surfaces — the Matches list, Match detail (pick flow), and Leaderboard/Standings — SHALL satisfy across accessibility (WCAG), mobile usability, visual consistency, and conversion. The criteria are expressed as testable requirements with scenarios so each remediation task derived from the live production review has an objective pass/fail. The scope is intentionally limited to the core prediction loop; admin, quiz, groups, news, and share surfaces are excluded.

## Requirements

### Requirement: Core content is reachable above excessive scroll on mobile

On a 390px-wide viewport, each core prediction-loop surface (Matches, Match detail, Leaderboard) SHALL present its primary content — the match list, the prediction control, or the ranking table — without requiring the user to scroll past a long secondary control first. Specifically, the Matches list's team filter SHALL NOT render its full team set inline by default; the team list SHALL be collapsed behind a disclosure or replaced by a search/select so the first match row is reachable within roughly two viewport heights of the page top.

#### Scenario: Team filter does not bury the match list on mobile
- **WHEN** the Matches page is loaded at 390px width
- **THEN** the full team list is not expanded inline by default
- **AND** the first match row is reachable within ~2 viewport heights of the top of the page

#### Scenario: Round filters remain directly accessible
- **WHEN** the team filter is collapsed behind a disclosure or search
- **THEN** the round filters (e.g. All rounds / Group stage / Round of 32) remain visible without opening the disclosure
- **AND** any active team filter is still indicated

### Requirement: Interactive controls meet touch-target and focus expectations

Every interactive control on the core prediction-loop surfaces (filter pills, match rows, primary actions, nav, pagination) SHALL have a touch target of at least 44×44 CSS pixels (including padding) on touch viewports, and SHALL expose a visible keyboard focus indicator that meets WCAG 2.4.7 when focused.

#### Scenario: Filter pills are comfortably tappable
- **WHEN** a round or team filter pill is measured at 390px width
- **THEN** its interactive box is at least 44px tall

#### Scenario: Keyboard focus is visible
- **WHEN** a user tabs to a filter pill, match row, or primary action
- **THEN** a visible focus indicator is rendered that is distinguishable from the unfocused state

### Requirement: Non-text UI elements meet contrast minimums

Borders, dividers, and the boundaries that separate match rows, cards, and table rows from the background SHALL meet a contrast ratio of at least 3:1 against adjacent colors (WCAG 1.4.11 non-text contrast) in both the light and dark themes. Secondary text on colored surfaces (e.g. the match-detail hero) SHALL meet at least 4.5:1 for normal-size text.

#### Scenario: Row and card boundaries are perceivable
- **WHEN** the Matches list or Leaderboard table is rendered in the dark theme
- **THEN** the dividers/borders separating rows or cards have at least 3:1 contrast against the background

#### Scenario: Hero secondary text is legible
- **WHEN** the match-detail hero shows secondary metadata (kickoff, venue, countdown, HOME/AWAY labels) on the colored card
- **THEN** that text meets at least 4.5:1 contrast against the card

### Requirement: The primary prediction action is a prominent, labeled control

On the Matches list and Match detail, the action that lets a user make or edit a prediction SHALL be presented as a clearly actionable, button-like control (not low-emphasis body text), with an accessible name that states the action, and SHALL be the highest-emphasis interactive element in its row or section.

#### Scenario: Pick action reads as an action on the list
- **WHEN** a pickable match is shown in the Matches list
- **THEN** its pick action is a button-like control with an accessible name describing the action (e.g. "Pick Algeria vs Austria")
- **AND** it is visually the primary action of that row

#### Scenario: Edit affordance on an existing pick
- **WHEN** a match already has the user's prediction
- **THEN** the surface offers a clearly labeled control to edit it before lock

### Requirement: Failures render a friendly state, never raw exception text

When a core prediction-loop surface fails to load its data, it SHALL render a human-readable empty/error state with a retry affordance and SHALL NOT display raw exception or stack text (e.g. `TypeError: fetch failed`) to the user. The error state SHALL be announced to assistive technology (e.g. `role="alert"`).

#### Scenario: Match load failure is friendly
- **WHEN** the Matches list fails to fetch its data
- **THEN** the user sees a plain-language message and a retry control
- **AND** no raw exception/stack string is shown

#### Scenario: Error is announced
- **WHEN** the error state appears after an interaction
- **THEN** it is exposed to assistive technology via an alert/status role

### Requirement: Scoring columns and abbreviations are explained in context

Where the Leaderboard/Standings surfaces use abbreviated column headers (e.g. `EXACT`, `W+GD`, `WINS`), each abbreviation SHALL be explained in context — via a visible legend, an accessible tooltip/`abbr` title, or an adjacent link to the scoring explainer — so a first-time viewer can interpret the columns without leaving the page.

#### Scenario: Abbreviated columns are decipherable
- **WHEN** the Leaderboard renders its `EXACT` / `W+GD` / `WINS` columns
- **THEN** each abbreviation has an in-context explanation (legend, tooltip/`abbr`, or link to the scoring rules)

### Requirement: Disclosure and density behavior are consistent across the prediction loop

Repeated patterns on the prediction-loop surfaces — matchday section expand/collapse, filter pills, row layouts — SHALL behave and render consistently. Collapsible sections SHALL use one consistent disclosure pattern and SHALL NOT leave large empty horizontal gaps in collapsed rows; equivalent controls SHALL share sizing and spacing.

#### Scenario: Matchday sections share one disclosure pattern
- **WHEN** matchday sections render in collapsed and expanded states
- **THEN** they use the same disclosure affordance and the collapsed row has no large empty horizontal gap

#### Scenario: Equivalent controls are visually consistent
- **WHEN** round filters and team filters are shown
- **THEN** equivalent pills share height, padding, and spacing
