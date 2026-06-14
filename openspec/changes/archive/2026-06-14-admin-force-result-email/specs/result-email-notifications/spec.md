## ADDED Requirements

### Requirement: Admins can force-dispatch result emails for a single final match, bypassing the ledger

The system SHALL provide an admin-initiated, match-scoped force-dispatch path that re-emails every player with a `scores` row for one `final` match, intentionally treating the `result_email_log` ledger as empty for that match so already-sent pairs are re-emailed. This path SHALL be scoped to a single `match_id` at the data layer (the scored-rows query filters on that `match_id`), so it can never widen beyond the target match's recipients. The automated cron path's at-most-once semantics SHALL be unchanged: only this explicit force path ignores the ledger.

#### Scenario: Force re-emails already-sent players for the match
- **WHEN** an admin force-dispatches result emails for a `final` match whose `(match_id, user_id)` pairs already have `result_email_log` rows
- **THEN** every player with a `scores` row for that match is emailed again
- **AND** no other match's recipients are emailed

#### Scenario: Force is scoped to one match
- **WHEN** an admin force-dispatches for match M while other final matches also have pending or already-sent recipients
- **THEN** only match M's scored players are resolved as recipients
- **AND** the other matches' recipients are not emailed by this call

#### Scenario: Cron path keeps at-most-once after a force-send
- **WHEN** an admin force-dispatches for a match and then the sync cron runs
- **THEN** the cron does not re-email that match's pairs, because the force path re-stamped the ledger

### Requirement: Force-dispatch re-stamps the ledger after a successful send

After Resend accepts a force-send batch, the system SHALL upsert `result_email_log` rows for the sent `(match_id, user_id)` pairs with `onConflict (match_id, user_id)` and ignore-duplicates, preserving any existing row (the ledger continues to mean "emailed at least once"). A force batch that Resend rejects SHALL NOT write ledger rows, mirroring the cron path's failure handling.

#### Scenario: Successful force re-stamps the ledger
- **WHEN** a force-send batch is accepted by Resend for pairs that already had ledger rows
- **THEN** the ledger still contains exactly one row per pair (duplicates ignored)
- **AND** subsequent cron runs treat those pairs as already sent

#### Scenario: Rejected force batch writes no ledger rows
- **WHEN** Resend rejects a force-send batch
- **THEN** no `result_email_log` rows are written for that batch
- **AND** the pairs are reported as failed in the summary

### Requirement: Force-dispatch reuses env-gating, batching, and the dispatch summary

The force-dispatch path SHALL share the cron path's send pipeline: it SHALL no-op (no sends, no ledger writes, no throw) when `RESEND_API_KEY` is unset, SHALL batch at most 100 messages per Resend call, SHALL skip (not fail) recipients without a resolvable email, and SHALL return the same `{ emailed, failed, skipped }` summary shape.

#### Scenario: Missing API key no-ops the force path
- **WHEN** an admin force-dispatches while `RESEND_API_KEY` is unset
- **THEN** no emails are sent, no ledger rows are written, nothing throws
- **AND** a zero `{ emailed: 0, failed: 0, skipped: 0 }` summary is returned

#### Scenario: Force respects the batch limit
- **WHEN** a force-dispatch resolves more than 100 recipients for a single match
- **THEN** they are sent in batches of at most 100

#### Scenario: Unresolvable email is skipped, not failed
- **WHEN** a force-dispatch recipient has no resolvable email address
- **THEN** that recipient is counted in `skipped` and the remaining recipients are still emailed
