## ADDED Requirements

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

## MODIFIED Requirements

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
