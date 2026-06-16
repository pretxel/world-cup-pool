# my-picks-pagination Specification

## Purpose

Defines how the My Picks predictions list is split into fixed-size pages: a page size of five, the `page` URL query parameter and its clamping, the pagination controls, and what stays computed over the whole pick set (header stats and the simulated group standings) rather than the visible page. Pagination is server-rendered and read-only — the windowing happens in memory over the already-loaded predictions; nothing is persisted.

## Requirements

### Requirement: Predictions list paginated at five per page

On the My Picks page, the system SHALL display the user's predictions list in pages of at most five picks. The picks SHALL be ordered by their match's kickoff time ascending (earliest first) as a deterministic property of the rendered list, with a stable secondary ordering key applied when two fixtures share a kickoff time so the order is reproducible run-to-run. This ordering SHALL be established over the user's complete pick set before it is split into pages, so the pages partition one global kickoff-ascending order: page 1 holds the earliest five, page 2 the next five, and so on. The ordering SHALL NOT depend on the database returning the predictions pre-sorted.

#### Scenario: More picks than one page
- **WHEN** a user has 12 predictions and views My Picks
- **THEN** the list shows the first 5 predictions in kickoff order
- **AND** the remaining 7 are reachable on later pages

#### Scenario: Fewer picks than a full page
- **WHEN** a user has 3 predictions
- **THEN** all 3 are shown on a single page
- **AND** no second page exists

#### Scenario: Exact multiple of the page size
- **WHEN** a user has 10 predictions
- **THEN** the list spans exactly 2 pages of 5

#### Scenario: Pages partition one global kickoff order
- **WHEN** a user with picks across many match dates pages through the list
- **THEN** every pick on an earlier page has a kickoff time at or before every pick on a later page
- **AND** no pick appears out of kickoff order relative to picks on other pages

#### Scenario: Ties are ordered deterministically
- **WHEN** two of the user's picks are for fixtures kicking off at the same time
- **THEN** their relative order is decided by a stable secondary key and is the same on every render

### Requirement: Current page comes from the `page` query param

The system SHALL determine the visible page from a `page` URL query parameter. When `page` is absent, the system SHALL show page 1. The system SHALL clamp the requested page into the valid range of 1 through the last page; a value below 1, above the last page, missing, or non-numeric SHALL resolve to the nearest valid page (1 when too low or invalid, the last page when too high).

#### Scenario: No page param defaults to first page
- **WHEN** a user opens My Picks with no `page` query param
- **THEN** the system shows page 1

#### Scenario: Valid page param
- **WHEN** a user opens My Picks with `?page=2` and at least two pages of picks exist
- **THEN** the system shows the second page of picks

#### Scenario: Page above the last page clamps down
- **WHEN** a user requests `?page=99` but only 3 pages exist
- **THEN** the system shows page 3 (the last page) rather than an empty list or an error

#### Scenario: Invalid or below-range page clamps to first
- **WHEN** a user requests `?page=0`, `?page=-4`, or `?page=abc`
- **THEN** the system shows page 1

### Requirement: Pagination controls

The system SHALL render pagination controls below the predictions list showing the current position ("Page X of Y") and links to the previous and next pages. The previous control SHALL be disabled (or absent) on the first page and the next control SHALL be disabled (or absent) on the last page. The system SHALL NOT render pagination controls when there is one page or fewer.

#### Scenario: Controls on a middle page
- **WHEN** the user is on page 2 of 4
- **THEN** the controls show "Page 2 of 4" with both previous and next enabled
- **AND** the previous link targets page 1 and the next link targets page 3

#### Scenario: First page disables previous
- **WHEN** the user is on page 1 of 3
- **THEN** the previous control is disabled and the next control is enabled

#### Scenario: Last page disables next
- **WHEN** the user is on page 3 of 3
- **THEN** the next control is disabled and the previous control is enabled

#### Scenario: Single page hides controls
- **WHEN** the user has 5 or fewer predictions (one page)
- **THEN** no pagination controls are rendered

### Requirement: Summary data spans all picks, not the visible page

The system SHALL compute the My Picks header statistics (total picks, exact-hit count, total points) over the user's complete set of predictions, independent of which page is shown. The simulated group-standings section SHALL likewise reflect all of the user's predictions and SHALL NOT be paginated.

#### Scenario: Stats unaffected by page
- **WHEN** a user with 12 picks moves from page 1 to page 2
- **THEN** the total picks, exact, and points stats stay the same on both pages

#### Scenario: Group simulation stays whole
- **WHEN** the user changes pages
- **THEN** the simulated group standings continue to reflect every prediction, not only the picks on the current page

### Requirement: Empty state unchanged

When the user has no predictions, the system SHALL show the existing empty state and SHALL NOT render pagination controls.

#### Scenario: No picks
- **WHEN** a user with zero predictions opens My Picks
- **THEN** the existing empty state is shown
- **AND** no pagination controls appear
