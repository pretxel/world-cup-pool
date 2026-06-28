## ADDED Requirements

### Requirement: Matches list defaults to non-finished fixtures

When no status filter is selected, the `/matches` list SHALL exclude finished fixtures — those whose status is `final` or `cancelled` — and show only non-finished fixtures (scheduled, locked, and live). This default applies after the existing confirmed-gating and the team/round filters. The `final` status filter SHALL still list finished fixtures when explicitly selected, so finished matches remain reachable on demand. The header status stat cards SHALL continue to count the full team/round-scoped set (including finished matches) so the Final card shows its true count and acts as the affordance to reveal finished fixtures. When the default view is empty solely because every in-scope fixture is finished (the Final count is non-zero and no team, round, or picks filter is active), the list SHALL render an empty state that points the user to the finished matches rather than a generic "no matches" message.

#### Scenario: Finished matches hidden by default
- **WHEN** a visitor opens `/matches` with no status filter selected
- **THEN** `final` and `cancelled` fixtures are not listed
- **AND** scheduled, locked, and live fixtures are listed

#### Scenario: Final filter opts finished matches back in
- **WHEN** the visitor selects the `final` status filter
- **THEN** the finished fixtures are listed

#### Scenario: Stat cards still count finished matches
- **WHEN** the default (non-finished) view is shown
- **THEN** the header Final stat card still displays the true count of finished fixtures in the scoped set

#### Scenario: All-finished empty state guides to results
- **WHEN** the default view has no rows only because every in-scope fixture is finished, with no team/round/picks filter active
- **THEN** an empty state is shown that directs the user to the finished matches (e.g. the Final filter)
- **AND** it is not the generic "no matches" empty state
