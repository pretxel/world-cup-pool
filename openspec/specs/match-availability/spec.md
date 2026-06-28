# match-availability Specification

## Purpose
TBD - created by archiving change match-team-confirmation. Update Purpose after archive.
## Requirements
### Requirement: A match is confirmed when both teams resolve to real countries

The system SHALL treat a match as *confirmed* when both its `home_team` and `away_team` resolve to a participating country via the team→flag mapping (`flagSlug` non-null), and *unconfirmed* otherwise. This predicate SHALL be the single rule that gates the public surface; no stored column or separate flag SHALL be introduced.

#### Scenario: Both teams are real countries
- **WHEN** a match has `home_team = "Brazil"` and `away_team = "Mexico"`
- **THEN** the match is confirmed

#### Scenario: A placeholder participant
- **WHEN** a match has `home_team = "2nd Group A"` and `away_team = "2nd Group B"`
- **THEN** the match is unconfirmed

#### Scenario: One side still a placeholder
- **WHEN** a match has `home_team = "Spain"` and `away_team = "Winner Match 73"`
- **THEN** the match is unconfirmed

### Requirement: Public matches list shows only confirmed matches

The `/matches` list SHALL render a fixture when it is **confirmed** (both teams resolve to real countries) **or** its knockout round is **revealed** by an admin. All other unconfirmed fixtures SHALL be excluded before team-filtering, header stat computation, and day grouping. Confirmed fixtures SHALL always appear regardless of any reveal flag, with no separate publish action when an admin sets both real teams. A revealed-but-unconfirmed fixture SHALL render as a read-only schedule row (placeholder participant text, date, venue, stage) and SHALL NOT show a "Pick" control.

#### Scenario: Placeholder fixtures hidden when their round is not revealed
- **WHEN** a visitor opens `/matches` while the schedule contains group fixtures and knockout fixtures with placeholder teams whose rounds are not revealed
- **THEN** only the confirmed (real-team) fixtures are rendered
- **AND** no row shows a placeholder participant such as "2nd Group A"

#### Scenario: Revealed round shows placeholder fixtures read-only
- **WHEN** an admin has revealed a knockout round and a visitor opens `/matches`
- **THEN** that round's fixtures appear with their date, venue, and placeholder participants
- **AND** those unconfirmed rows show no "Pick" control

#### Scenario: Stats reflect the visible set
- **WHEN** the list is gated to the visible set (confirmed plus revealed-round fixtures)
- **THEN** the header open/live/final stats and each matchday count are computed over that visible set

#### Scenario: Confirming a match reveals it
- **WHEN** an admin sets both teams of a knockout fixture to real countries
- **AND** a visitor reloads `/matches`
- **THEN** that fixture now appears in the list

### Requirement: Unconfirmed match detail page is not pickable

The `/matches/[matchId]` page for an unconfirmed match SHALL remain reachable (no 404) but SHALL render a "teams not confirmed yet" state in place of the prediction area, and SHALL NOT render the prediction form, regardless of sign-in or lock state.

#### Scenario: Detail of an unconfirmed match
- **WHEN** a user opens the detail page of a match with a placeholder team
- **THEN** the page renders a not-confirmed message
- **AND** no prediction form is shown

#### Scenario: Confirmed match detail unchanged
- **WHEN** a user opens the detail page of a confirmed, unlocked match while signed in
- **THEN** the prediction form is shown as before

### Requirement: Prediction submission rejects unconfirmed matches

The `submitPrediction` server action SHALL reject any prediction targeting an unconfirmed match and return a localized error, independent of the UI gating. This condition is enforced at the action layer and is additional to the existing status/kickoff lock.

#### Scenario: Direct submission for an unconfirmed match
- **WHEN** `submitPrediction` is called for a match whose teams are not both confirmed
- **THEN** it returns `{ ok: false }` with a localized "teams not confirmed" error
- **AND** no prediction row is written

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

