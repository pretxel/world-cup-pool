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

### Requirement: Admin can trigger a result sync on demand

The `/admin/matches` page SHALL provide a "Sync now" control that invokes the shared result-sync core directly (server action, no HTTP hop through the cron route) and, on completion, revalidates the matches views and surfaces the run summary (source used, matched, final, stale counts, errors) to the admin. The action SHALL be available only within the existing admin-gated layout.

#### Scenario: Manual sync resolves a missing result
- **WHEN** an admin clicks "Sync now" while a finished match is still non-final locally
- **AND** a result provider returns the final score for that match
- **THEN** the match is updated to `status='final'` with its score and `compute_match_scores` runs for it
- **AND** the admin sees a run summary including the source used

#### Scenario: Manual sync reports failure visibly
- **WHEN** an admin clicks "Sync now" and every provider fails
- **THEN** the admin sees a summary with `source: "none"` and a non-zero error count, rather than a silent success

### Requirement: Admin surfaces stale results

Each match row on `/admin/matches` SHALL display a stale indicator when the match's `kickoff_at` is more than 3 hours past, its status is not terminal (`final`/`cancelled`), and both teams resolve to real countries — the same staleness rule used by the sync core. Non-stale matches SHALL NOT show the indicator.

#### Scenario: Stale badge shown
- **WHEN** an admin views `/admin/matches` and a confirmed match kicked off 4 hours ago without a final result
- **THEN** that row shows a stale indicator

#### Scenario: No badge for finals or upcoming matches
- **WHEN** a match is `status='final'` or its kickoff is in the future
- **THEN** that row does not show the stale indicator
