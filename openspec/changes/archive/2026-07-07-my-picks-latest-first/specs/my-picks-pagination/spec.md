# my-picks-pagination Delta

## MODIFIED Requirements

### Requirement: Predictions list paginated at five per page

On the My Picks page, the system SHALL display the user's predictions list in pages of at most five picks. The picks SHALL be ordered by their match's kickoff time descending (latest first) as a deterministic property of the rendered list, with a stable secondary ordering key applied when two fixtures share a kickoff time so the order is reproducible run-to-run. Picks whose match has a missing or unparseable kickoff time SHALL sort after all picks with a valid kickoff. This ordering SHALL be established over the user's complete pick set before it is split into pages, so the pages partition one global kickoff-descending order: page 1 holds the latest five, page 2 the next five, and so on. The ordering SHALL NOT depend on the database returning the predictions pre-sorted.

#### Scenario: More picks than one page
- **WHEN** a user has 12 predictions and views My Picks
- **THEN** the list shows the 5 predictions with the latest kickoff times
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
- **THEN** every pick on an earlier page has a kickoff time at or after every pick on a later page
- **AND** no pick appears out of kickoff order relative to picks on other pages

#### Scenario: Ties are ordered deterministically
- **WHEN** two of the user's picks are for fixtures kicking off at the same time
- **THEN** their relative order is decided by a stable secondary key and is the same on every render

#### Scenario: Missing kickoff sorts last
- **WHEN** one of the user's picks is for a fixture whose kickoff time is missing or unparseable
- **THEN** that pick appears after every pick with a valid kickoff time
