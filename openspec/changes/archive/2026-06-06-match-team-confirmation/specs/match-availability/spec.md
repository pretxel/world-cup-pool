## ADDED Requirements

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

The `/matches` list SHALL render only confirmed matches. Unconfirmed matches SHALL be excluded before team-filtering, header stat computation, and day grouping, so the header stats, per-day counts, and rendered rows all reflect the confirmed set. When an admin sets both real teams on a previously unconfirmed match, it SHALL appear on the list on the next request with no separate publish action.

#### Scenario: Placeholder fixtures hidden
- **WHEN** a visitor opens `/matches` while the schedule contains group fixtures and knockout fixtures with placeholder teams
- **THEN** only the confirmed (real-team) fixtures are rendered
- **AND** no row shows a placeholder participant such as "2nd Group A"

#### Scenario: Stats reflect the confirmed set
- **WHEN** the list is gated to confirmed matches
- **THEN** the header open/live/final stats and each matchday count are computed over the confirmed matches only

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
