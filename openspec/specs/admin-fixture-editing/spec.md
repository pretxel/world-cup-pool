# admin-fixture-editing Specification

## Purpose
TBD - created by archiving change match-team-confirmation. Update Purpose after archive.
## Requirements
### Requirement: Admin can edit an existing fixture's fields

The `/admin/matches` page SHALL provide, for each existing match, a form that updates that match's `stage`, `group_code`, `home_team`, `away_team`, `kickoff_at`, and `venue`. The form SHALL submit to the existing `saveFixture` action with the match's `id` so the update path is used, applying the same validation as fixture creation (non-empty teams, home ≠ away, valid stage, optional `A`–`L` group code). The future-kickoff guard SHALL NOT apply to edits, so an admin may confirm teams on an imminent or past fixture.

#### Scenario: Set real teams on a placeholder fixture
- **WHEN** an admin opens the edit form for a knockout match showing "2nd Group A" vs "2nd Group B"
- **AND** sets `home_team = "Brazil"` and `away_team = "Croatia"` and saves
- **THEN** the match is updated to Brazil vs Croatia
- **AND** the `/matches` and `/admin/matches` views are revalidated

#### Scenario: Edit validation
- **WHEN** an admin submits the edit form with `home_team` equal to `away_team`
- **THEN** the update is rejected with an error and the match is unchanged

#### Scenario: Editing does not require a future kickoff
- **WHEN** an admin edits a fixture whose `kickoff_at` is in the past or near future
- **THEN** the team/field update succeeds (no "kickoff must be in the future" error)

### Requirement: Admin surfaces which fixtures are unconfirmed

Each match row on `/admin/matches` SHALL display an explicit indicator when the match is unconfirmed (either team does not resolve to a real country), so admins can identify fixtures that still need their teams set. Confirmed matches SHALL NOT show the indicator.

#### Scenario: Unconfirmed badge shown
- **WHEN** an admin views `/admin/matches` and a row's match has a placeholder participant
- **THEN** that row shows an "Unconfirmed" indicator

#### Scenario: No badge once confirmed
- **WHEN** a match's both teams resolve to real countries
- **THEN** that row does not show the "Unconfirmed" indicator

