# admin-fixture-editing Specification

## Purpose
TBD - created by archiving change match-team-confirmation. Update Purpose after archive.
## Requirements
### Requirement: Admin can edit an existing fixture's fields

The `/admin/matches/[matchId]` detail page SHALL provide a form that updates that match's `stage`, `group_code`, `home_team`, `away_team`, `kickoff_at`, and `venue`. The form SHALL submit to the existing `saveFixture` action with the match's `id` so the update path is used, applying the same validation as fixture creation (non-empty teams, home ≠ away, valid stage, optional `A`–`L` group code). The future-kickoff guard SHALL NOT apply to edits, so an admin may confirm teams on an imminent or past fixture. The list page SHALL NOT carry this form.

#### Scenario: Set real teams on a placeholder fixture
- **WHEN** an admin opens the detail page for a knockout match showing "2nd Group A" vs "2nd Group B"
- **AND** sets `home_team = "Brazil"` and `away_team = "Croatia"` and saves
- **THEN** the match is updated to Brazil vs Croatia
- **AND** the `/matches`, `/admin/matches`, and the match detail views are revalidated

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

### Requirement: Fixtures/results admin scope to the managed competition

The admin fixtures list and the fixture/result/delete actions SHALL scope to the MANAGED competition (the admin editing context) rather than to all matches or solely to the active competition. The matches list SHALL filter `.eq('competition_id', managedId)`. `saveFixture` SHALL stamp new fixtures with the managed `competition_id`, derive its stage options and `group_code` validation from the managed competition's `format_config`, hide the `group_code` input when the managed competition has no group stage, and reject any submitted `competition_id` that does not equal the server-derived managed id. `setMatchResult`, `forceRecompute`, and `deleteMatch` SHALL verify the target match belongs to the managed competition before mutating. In the single-seeded WC2026 case the managed competition equals the active competition, so behavior is unchanged.

#### Scenario: List scoped to managed

- **WHEN** an admin sets a non-active competition as managed and opens `/admin/matches`
- **THEN** only that competition's fixtures are listed
- **AND** the stage options come from its `format_config`

#### Scenario: New fixture stamped with managed competition

- **WHEN** an admin creates a fixture while managing a competition
- **THEN** the inserted row has `competition_id` equal to the managed competition's id

#### Scenario: Group input hidden for league-only formats

- **WHEN** the managed competition has `groups.enabled = false`
- **THEN** the `group_code` input is not rendered
- **AND** submitting a fixture stores `group_code` as NULL

#### Scenario: Cross-competition mutation rejected

- **WHEN** a stale form posts a `match_id` belonging to a competition other than the current managed one
- **THEN** the action mutates zero rows and returns a clear error rather than editing another competition

#### Scenario: Invalid stage rejected against managed format

- **WHEN** a fixture submission carries a stage not present in the managed competition's `format_config`
- **THEN** the server validation rejects it before the database write

### Requirement: Manual sync targets the managed competition

The admin `syncNow` action SHALL pass the managed competition id into `runSync({ competitionId })` so an admin can sync a non-active competition's providers, while the cron route SHALL continue to call `runSync()` with no competition argument and thereby sync only the public active competition. Revalidation after an admin mutation SHALL skip public paths and the leaderboard tag when the managed competition is not active, and perform the full public revalidation when managed equals active.

#### Scenario: Manual sync uses managed scope

- **WHEN** an admin triggers Sync results now while managing a non-active competition
- **THEN** `runSync` is invoked with that competition's id
- **AND** only its matches/providers are used

#### Scenario: Cron stays on active

- **WHEN** the cron route triggers a sync with no competition specified
- **THEN** the sync defaults to the active competition

#### Scenario: Non-active mutation skips public revalidation

- **WHEN** an admin saves a result on a managed competition that is not the active one
- **THEN** public paths and the leaderboard tag are not revalidated
- **AND** only the admin matches path is revalidated

### Requirement: Admin can resend result emails for a final match

The `/admin/matches/[matchId]` detail page SHALL provide, for a `final` match, a Resend result emails control alongside the other per-match maintenance actions. Activating it SHALL invoke an `assertAdmin()`-gated server action, scoped to the managed competition via `assertMatchInManaged`, that force-dispatches result emails for that match (re-emailing its scored players regardless of the dedupe ledger). The control SHALL NOT be offered for non-`final` matches, and the server action SHALL re-check the match is `final` and reject otherwise with a readable error. The list page SHALL NOT carry this control.

#### Scenario: Resend control appears only for final matches
- **WHEN** an admin opens the detail page for a `final` match
- **THEN** the Resend result emails control is shown
- **AND** when an admin opens the detail page for a `scheduled` match the control is not shown

#### Scenario: Resend re-emails the match's players
- **WHEN** an admin activates Resend result emails for a `final` match whose players were already emailed
- **THEN** the server action force-dispatches result emails for that match
- **AND** those players are emailed again

#### Scenario: Non-admin is rejected
- **WHEN** a non-admin invokes the resend action
- **THEN** the action throws and no emails are sent

#### Scenario: Out-of-managed-competition match is rejected
- **WHEN** an admin invokes the resend action for a match outside the managed competition
- **THEN** the action rejects via `assertMatchInManaged` and no emails are sent

#### Scenario: Non-final match is rejected server-side
- **WHEN** the resend action is invoked for a match that is not `final`
- **THEN** it returns a readable error and sends no emails

### Requirement: Resend reports an emailed/failed/skipped summary

After a resend, the match detail page SHALL surface the dispatch `{ emailed, failed, skipped }` summary to the admin (e.g. an inline outcome) so the result is visible rather than a blind success, keeping `skipped` (no resolvable email) distinct from `failed` (Resend rejected).

#### Scenario: Summary is shown after resend
- **WHEN** a resend emails 7 players, skips 1 with no email, and has 0 failures
- **THEN** the admin sees a summary reporting emailed 7, skipped 1, failed 0 on the detail page

#### Scenario: No-op resend reports zeros
- **WHEN** an admin resends while `RESEND_API_KEY` is unset
- **THEN** the summary reports emailed 0, failed 0, skipped 0 and no error is shown

### Requirement: Admin matches list is a read-only index

The `/admin/matches` list SHALL render each match row as a read-only index entry, showing the fixture's teams, score, status, stage, and kickoff, plus the existing Unconfirmed and Stale indicators, and SHALL provide a single **Open** control linking to that match's detail page at `/admin/matches/[matchId]`. The list row SHALL NOT render per-match editing or maintenance controls (no inline result-entry form, no Edit fixture form, no Force recompute, Resend result emails, Summarize, or Delete fixture controls); those controls live on the detail page. Page-level controls that are not per-match — the managed-competition context, the **New fixture** create form, and the **Sync results now** control — SHALL remain on the list page.

#### Scenario: Row shows display and Open only
- **WHEN** an admin views `/admin/matches`
- **THEN** each row shows the fixture's teams, score, status, stage, kickoff, and any Unconfirmed/Stale indicators
- **AND** each row offers an Open control to that match's detail page
- **AND** no per-match result, edit, recompute, resend, summarize, or delete control is rendered in the row

#### Scenario: Page-level controls remain on the list
- **WHEN** an admin views `/admin/matches`
- **THEN** the New fixture create form and the Sync results now control are still available on the list page

