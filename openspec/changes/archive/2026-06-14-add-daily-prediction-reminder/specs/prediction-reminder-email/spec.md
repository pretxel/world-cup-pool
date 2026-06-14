## ADDED Requirements

### Requirement: Daily prediction reminder dispatch

The system SHALL provide a scheduled job that, once per day, emails each eligible player a reminder of today's matches they still need to predict. The job SHALL be reachable as a cron route at `/api/cron/prediction-reminders`.

The job SHALL be a no-op (return a zero summary, send nothing) when the email provider is not configured (`RESEND_API_KEY` unset) or when there are no matches scheduled for today.

#### Scenario: Reminders sent for today's open matches

- **WHEN** the job runs and there is at least one confirmed, still-open match scheduled for today
- **THEN** each opted-in player who has not predicted every such match receives one email listing the matches they still need to predict

#### Scenario: No matches today

- **WHEN** the job runs and no matches are scheduled for today
- **THEN** the job sends no email and returns a zero summary `{ emailed: 0, failed: 0, skipped: 0 }`

#### Scenario: Email provider not configured

- **WHEN** the job runs and `RESEND_API_KEY` is unset
- **THEN** the job sends no email and returns a zero summary without error

### Requirement: Pending-match selection

A match SHALL be included in a player's reminder only when ALL of the following hold at send time: it is scheduled for today (its `kickoff_at` falls within today's date window), both teams are confirmed real participants (not knockout placeholders), it is still open (status `scheduled` and `kickoff_at` is in the future), and the player has no existing prediction for it.

#### Scenario: Locked or in-progress match excluded

- **WHEN** a match scheduled for today is `live`, `final`, `cancelled`, or already past its `kickoff_at`
- **THEN** that match is excluded from every player's reminder

#### Scenario: Placeholder fixture excluded

- **WHEN** a match scheduled for today has an unconfirmed participant (e.g. "2nd Group A", "Winner Match 73")
- **THEN** that match is excluded from every player's reminder

#### Scenario: Already-predicted match excluded for that player

- **WHEN** a player has already submitted a prediction for a today match
- **THEN** that match does not appear in that player's reminder

#### Scenario: Player with nothing pending is skipped

- **WHEN** a player has already predicted every confirmed, open match scheduled for today
- **THEN** that player receives no reminder email

### Requirement: Per-player per-day idempotency

The system SHALL send at most one prediction reminder to a given player per day. Delivered reminders SHALL be recorded in a ledger keyed by player and reminder date, and a player already present in the ledger for today SHALL be excluded from sending. Ledger rows SHALL be written only for messages the email provider accepted, so undelivered reminders are retried on a later run the same day.

#### Scenario: Repeat run does not re-send

- **WHEN** the job runs twice in the same day and a player was already emailed (and recorded) on the first run
- **THEN** the player is not emailed again on the second run

#### Scenario: Failed send retries

- **WHEN** a reminder send fails for a player on one run
- **THEN** no ledger row is written for that player and they remain eligible on a later run the same day

### Requirement: Reminder email content

The reminder email SHALL be localized (English, Spanish, French), SHALL greet the player by display name when available, SHALL list today's pending matches (each showing the two teams and the kickoff time), and SHALL include a call-to-action linking to the player's picks and a one-click unsubscribe link. The email SHALL be sent using the active competition's branding sender name and SHALL include `List-Unsubscribe` / `List-Unsubscribe-Post` headers.

#### Scenario: Match list rendered

- **WHEN** a reminder is built for a player with two pending matches today
- **THEN** the email body lists both matches with their teams and kickoff times and a CTA to make predictions

#### Scenario: Unsubscribe affordance present

- **WHEN** a reminder email is sent
- **THEN** it contains a visible unsubscribe link and the corresponding `List-Unsubscribe` headers

### Requirement: Opt-out and one-click unsubscribe

Players SHALL be able to opt out of prediction reminders independently of any other email. Opt-out SHALL be controlled by a dedicated `prediction_reminder_opt_out` flag on the player's profile, and opted-out players SHALL be excluded from sending. A one-click unsubscribe endpoint at `/api/prediction-reminders/unsubscribe` SHALL set that flag for the profile matching the supplied `unsubscribe_token`. The endpoint SHALL require no authentication beyond the opaque token, SHALL accept both GET and POST (RFC 8058), and SHALL return the same friendly confirmation regardless of whether the token matched.

#### Scenario: Unsubscribe via token

- **WHEN** a request hits the unsubscribe endpoint with a valid `unsubscribe_token`
- **THEN** the matching profile's `prediction_reminder_opt_out` is set to true and a confirmation is returned

#### Scenario: Opted-out player excluded

- **WHEN** the job runs and a player has `prediction_reminder_opt_out` set to true
- **THEN** that player receives no reminder email

#### Scenario: Opt-out is independent of quiz reminders

- **WHEN** a player has unsubscribed from prediction reminders
- **THEN** their daily-quiz-email opt-out state is unchanged

### Requirement: Cron authorization

The cron route SHALL require an `Authorization: Bearer ${CRON_SECRET}` header when `CRON_SECRET` is set, returning 401 otherwise. When no secret is set and the environment is production, the route SHALL skip without sending.

#### Scenario: Missing secret in production

- **WHEN** the route is called in production with no `CRON_SECRET` configured
- **THEN** it returns a skipped response and sends nothing

#### Scenario: Wrong bearer token

- **WHEN** `CRON_SECRET` is set and the request's bearer token does not match
- **THEN** the route returns 401 and sends nothing

### Requirement: Resilient dispatch

A failure affecting one player or one send batch SHALL be logged and counted, and SHALL NOT abort the remaining sends. The cron route SHALL surface a zero summary rather than a 500 on an unexpected dispatch failure, so a flaky run does not trip cron alerting.

#### Scenario: One batch fails, others continue

- **WHEN** sending one batch of reminders fails
- **THEN** the failure is counted, the remaining batches still send, and the job returns a summary

#### Scenario: Unexpected error does not 500

- **WHEN** the dispatch throws an unexpected error
- **THEN** the cron route logs it and returns a zero summary with a 200 response
