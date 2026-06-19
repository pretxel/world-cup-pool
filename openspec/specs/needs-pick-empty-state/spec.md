## Purpose

A helpful empty state on `/matches` shown when the signed-in "Needs Pick" filter yields zero matches — an "all caught up, come back tomorrow" message with a link back to all matches, replacing the silent generic filtered-empty dead-end.

## Requirements

### Requirement: All-caught-up empty state for the Needs Pick filter

When the signed-in "Needs Pick" filter (`?picks=needed`) is active and no matches remain to display, the matches page SHALL render a dedicated "all caught up" empty state instead of the generic filtered-empty copy. This state SHALL show an encouraging title and body indicating the user has no pending picks and can come back later, and SHALL NOT frame the result as a failed search.

#### Scenario: Needs-pick filter yields zero matches
- **WHEN** a signed-in user has the Needs Pick filter active and every remaining fixture is already picked, locked, live, or final so the filtered list is empty
- **THEN** the page shows an "all caught up — come back tomorrow" empty state
- **AND** it does not show the generic "no fixtures match your filters" copy

#### Scenario: Needs-pick filter with results is unaffected
- **WHEN** a signed-in user has the Needs Pick filter active and at least one fixture still needs a pick
- **THEN** the matching fixtures are listed and no empty state is shown

### Requirement: Link back to all matches from the all-caught-up state

The all-caught-up empty state SHALL provide a control that links back to the full, unfiltered matches list. Following it SHALL return the user to all matches with the Needs Pick filter cleared, and the control SHALL be labeled as viewing all matches rather than as clearing filters.

#### Scenario: User returns to all matches
- **WHEN** the all-caught-up empty state is shown and the user activates its link
- **THEN** the user is taken to the matches page with the Needs Pick filter no longer active
- **AND** the full schedule is displayed

### Requirement: Other empty states are preserved

The change SHALL NOT alter the empty states shown when the Needs Pick filter is not the cause. The generic filtered-empty state for team or status filters and the no-fixtures-loaded state SHALL remain unchanged.

#### Scenario: Team or status filter with no needs-pick still shows the generic empty state
- **WHEN** a user has only a team or status filter active (the Needs Pick filter is off) and the filtered list is empty
- **THEN** the generic filtered-empty copy and its "clear filters" link are shown, unchanged

#### Scenario: No fixtures loaded still shows the seed-prompt empty state
- **WHEN** no fixtures are available and no filters are active
- **THEN** the existing no-fixtures empty state is shown, unchanged

### Requirement: Localized all-caught-up copy

The all-caught-up empty state's title, body, and link label SHALL render in the active locale across the supported locales (en, es, fr, de).

#### Scenario: Localized rendering
- **WHEN** the all-caught-up empty state is shown under a supported locale
- **THEN** its title, body, and link label render in that locale
