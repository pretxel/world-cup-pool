# result-email-notifications

## Purpose

Rules governing the transactional emails sent when the result-sync cron finalizes a match. Defines who is emailed, the at-most-once dedupe ledger and its backfill, the per-player snapshot content, the web-matching email template, Resend delivery + env gating, and the default-locale rule. Triggered by the `automated-results` cron run after it recomputes scores.

## Requirements

### Requirement: Email recipients are players whose standing changed on a newly-final match

When a match reaches `final` status and `compute_match_scores` has written `public.scores` rows for it, the system SHALL treat every distinct `user_id` with a `scores` row for that match as a recipient. The system SHALL NOT email players who did not predict the match, and SHALL NOT email anyone for matches that are not `final`.

#### Scenario: Players who predicted a finalized match are recipients
- **WHEN** a match transitions to `final` and `scores` rows exist for users A and B (who predicted it) but not user C (who did not)
- **THEN** users A and B are resolved as recipients
- **AND** user C is not a recipient

#### Scenario: Non-final matches produce no recipients
- **WHEN** a match is `live` or `scheduled`
- **THEN** no recipients are resolved for it

### Requirement: Delivery is at-most-once per (match, player) via a dedupe ledger

The system SHALL maintain a `result_email_log` table with a unique `(match_id, user_id)` constraint. A `(match_id, user_id)` pair is a pending recipient only when its match is `final`, a `scores` row exists for the pair, and no ledger row exists for it. The system SHALL write the ledger row only after Resend accepts the message, so a pair is emailed at most once and failed sends remain pending for retry on the next run.

#### Scenario: Already-sent recipient is skipped
- **WHEN** a `result_email_log` row already exists for `(match_id, user_id)`
- **THEN** that pair is not re-emailed on subsequent runs

#### Scenario: Failed send remains pending
- **WHEN** Resend rejects the message for a pending pair
- **THEN** no ledger row is written for that pair
- **AND** the pair is retried on the next run

#### Scenario: Crash before send leaves the pair recoverable
- **WHEN** a match finalizes and its scores are computed but the process exits before the email is sent
- **THEN** the pair has no ledger row
- **AND** the next dispatch run resolves it as pending and sends it

### Requirement: Creation migration backfills existing finals so no historical results are emailed

The migration that creates `result_email_log` SHALL insert a ledger row for every `(match_id, user_id)` in `public.scores` whose match is already `final` at migration time. After backfill, the pending-recipient query SHALL return no rows for pre-existing finals, so deploying the feature emails nobody retroactively.

#### Scenario: Historical finals are pre-marked as sent
- **WHEN** the migration runs against a database with already-final matches and their score rows
- **THEN** a `result_email_log` row exists for every such `(match_id, user_id)`
- **AND** the first dispatch after deploy sends no emails for those matches

### Requirement: Email content is a personal standing snapshot plus the finished match(es)

Each email SHALL contain the recipient's current global standing from `v_leaderboard_overall` (rank, total points, exact-hit count, winner/GD-hit count) and, for each match that triggered the email, the match teams, the final scoreline, and the recipient's per-match outcome (`points` earned and `hit_type`). A recipient affected by multiple matches finalized together SHALL receive a single email covering all of them.

#### Scenario: Snapshot reflects current standing
- **WHEN** an email is rendered for a recipient ranked 4th with 18 total points
- **THEN** the email shows rank 4 and 18 points sourced from `v_leaderboard_overall`

#### Scenario: Per-match outcome is shown
- **WHEN** the recipient scored an exact hit (5 points) on the finalized match `Mexico 2–1 South Africa`
- **THEN** the email shows that scoreline and the recipient's 5-point exact outcome

#### Scenario: Multiple finalized matches yield one email
- **WHEN** two matches the recipient predicted both go final in the same run
- **THEN** the recipient receives one email listing both matches and a single current standing

### Requirement: Email template mirrors the web UI using email-safe HTML

The email SHALL be rendered by a pure function producing `subject`, `html`, and `text` parts. The HTML SHALL use table-based layout with inline styles and fixed hex colors equivalent to the app's light-theme tokens (pitch green, cream background, gold accent, ink text), reproducing the leaderboard's visual language: a pitch-green header, ranking tones (1st gold, 2nd ink, 3rd green), an outcome chip (exact = gold, winner/GD = green, miss = muted), and mono uppercase labels. A plain-text part SHALL mirror the content for non-HTML clients. The renderer SHALL require no database or network access.

#### Scenario: Renderer is pure and testable
- **WHEN** `renderResultEmail(data)` is called with a recipient payload
- **THEN** it returns `{ subject, html, text }` without any database or network call

#### Scenario: HTML uses email-safe styling
- **WHEN** the HTML is generated
- **THEN** colors are inline hex values and layout uses tables (no oklch, no CSS variables, no external stylesheet)

### Requirement: Delivery uses Resend and is gated by environment configuration

The system SHALL send through Resend using `RESEND_API_KEY`, with the sender taken from `EMAIL_FROM`. Sends SHALL be batched within Resend's per-call limit (≤100 messages per batch). When `RESEND_API_KEY` is absent, the dispatch step SHALL no-op (log and return a zero summary) without throwing, mirroring the cron's env-gating behavior.

#### Scenario: Missing API key skips dispatch
- **WHEN** `RESEND_API_KEY` is not set
- **THEN** the dispatch step performs no sends, writes no ledger rows, and does not throw

#### Scenario: Recipients are batched
- **WHEN** more than 100 messages are queued in one run
- **THEN** they are sent in batches of at most 100

### Requirement: Email sends are rendered in the default locale

Because `profiles` has no locale column, the system SHALL render emails using the application's default locale via the `email` i18n namespace. Locale resolution SHALL be isolated so a future per-user locale can be supplied without restructuring the renderer.

#### Scenario: Emails use the default locale
- **WHEN** an email is rendered for any recipient
- **THEN** its copy comes from the `email` namespace in the default locale

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
