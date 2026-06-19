## ADDED Requirements

### Requirement: First-pick lead state on /matches

The public `/matches` page SHALL render a first-pick lead state, above the day-grouped fixture list, when ALL of the following hold: the visitor is signed in, the visitor has made zero predictions, and no team, status, or needs-pick filter is active. The lead state SHALL be additive — the fixture list SHALL continue to render below it. When the visitor is not signed in, has at least one prediction, or has any active filter, the lead state SHALL NOT render.

#### Scenario: New signed-in user with no picks and no filters
- **WHEN** a signed-in user with zero predictions opens `/matches` with no active filters
- **THEN** the first-pick lead state is shown above the fixture list
- **AND** the full day-grouped fixture list still renders below it

#### Scenario: User with at least one pick
- **WHEN** a signed-in user who has made one or more predictions opens `/matches`
- **THEN** the first-pick lead state is not shown

#### Scenario: Anonymous visitor
- **WHEN** an unauthenticated visitor opens `/matches`
- **THEN** the first-pick lead state is not shown

#### Scenario: A filter is active
- **WHEN** a signed-in user with zero predictions opens `/matches` with a team, status, or needs-pick filter active
- **THEN** the first-pick lead state is not shown

### Requirement: Highlight the soonest pickable match

When the first-pick lead state renders and at least one confirmed match is still pickable (unlocked and scheduled), it SHALL highlight the soonest such match — the earliest still-pickable fixture by kickoff — and SHALL present a "Make your first pick" call-to-action that links to that match's detail page.

#### Scenario: Soonest pickable match is surfaced
- **WHEN** the first-pick lead state renders and there is at least one still-pickable confirmed match
- **THEN** it highlights the earliest still-pickable fixture by kickoff time
- **AND** it shows a "Make your first pick" call-to-action that links to that match's detail page

#### Scenario: Locked, live, and final matches are skipped
- **WHEN** the earliest fixtures by kickoff are already locked, live, or final and a later fixture is still open
- **THEN** the highlighted match is the earliest still-pickable fixture, not a locked/live/final one

### Requirement: Encouraging message when nothing is pickable

When the first-pick lead state renders but no confirmed match is currently pickable (every fixture is locked, live, or final), it SHALL show an encouraging message and SHALL NOT present a call-to-action link to a match.

#### Scenario: No open matches right now
- **WHEN** the first-pick lead state renders and no confirmed match is still pickable
- **THEN** an encouraging "no open matches right now" message is shown
- **AND** no match call-to-action link is rendered

### Requirement: Localized first-pick lead state

The first-pick lead state's text — its eyebrow, title, call-to-action label, and the no-open-matches message — SHALL render in the active locale (en, es, fr, de).

#### Scenario: Localized rendering
- **WHEN** the first-pick lead state is shown under a supported locale
- **THEN** its eyebrow, title, call-to-action, and no-open-matches copy render in that locale
