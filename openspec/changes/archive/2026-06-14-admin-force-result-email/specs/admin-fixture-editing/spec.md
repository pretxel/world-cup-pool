## ADDED Requirements

### Requirement: Admin can resend result emails for a final match

The `/admin/matches` page SHALL provide, for each `final` match, a Resend result emails control alongside the existing per-match maintenance actions. Activating it SHALL invoke an `assertAdmin()`-gated server action, scoped to the managed competition via `assertMatchInManaged`, that force-dispatches result emails for that match (re-emailing its scored players regardless of the dedupe ledger). The control SHALL NOT be offered for non-`final` matches, and the server action SHALL re-check the match is `final` and reject otherwise with a readable error.

#### Scenario: Resend control appears only for final matches
- **WHEN** an admin views the matches list containing a `final` match and a `scheduled` match
- **THEN** the Resend result emails control is shown for the `final` match
- **AND** it is not shown for the `scheduled` match

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

After a resend, the admin matches surface SHALL surface the dispatch `{ emailed, failed, skipped }` summary to the admin (e.g. a toast) so the outcome is visible rather than a blind success, keeping `skipped` (no resolvable email) distinct from `failed` (Resend rejected).

#### Scenario: Summary is shown after resend
- **WHEN** a resend emails 7 players, skips 1 with no email, and has 0 failures
- **THEN** the admin sees a summary reporting emailed 7, skipped 1, failed 0

#### Scenario: No-op resend reports zeros
- **WHEN** an admin resends while `RESEND_API_KEY` is unset
- **THEN** the summary reports emailed 0, failed 0, skipped 0 and no error is shown
