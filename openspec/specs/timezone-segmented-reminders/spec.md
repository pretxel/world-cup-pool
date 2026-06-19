# timezone-segmented-reminders Specification

## Purpose
Persist each user's timezone on their profile and run the prediction + quiz reminder crons hourly so each user is emailed on the run nearest 7am in their own timezone, reusing the existing eligibility, batching, and per-day dedup. This lands the product's main retention nudge when the user is awake and likely to act, instead of one fixed UTC instant that reaches players in the Americas while they sleep.

## Requirements

### Requirement: Persisted per-user timezone on the profile
The system SHALL store each user's IANA timezone in a new nullable column `profiles.timezone`. For a signed-in request that carries a valid `tz` cookie (the cookie written client-side by `components/timezone-sync.tsx`), when the cookie value differs from the stored `profiles.timezone`, the system SHALL persist the cookie value to that user's `profiles.timezone`. The persisted value MUST be validated as a resolvable IANA zone via `isValidTimeZone` (`lib/match-utils.ts`) before it is written; an absent or invalid `tz` cookie MUST NOT change the stored value. Persisting the timezone SHALL be best-effort and MUST NOT block or break page rendering.

#### Scenario: New valid timezone is persisted
- **WHEN** a signed-in user makes a request carrying a valid `tz` cookie whose value differs from their stored `profiles.timezone`
- **THEN** the system writes the validated cookie value to that user's `profiles.timezone`

#### Scenario: Unchanged timezone is a no-op
- **WHEN** a signed-in user's valid `tz` cookie already equals their stored `profiles.timezone`
- **THEN** no write is performed

#### Scenario: Invalid or absent cookie is ignored
- **WHEN** the request has no `tz` cookie, or the cookie value fails `isValidTimeZone`
- **THEN** `profiles.timezone` is left unchanged

#### Scenario: Persistence failure does not break the page
- **WHEN** writing `profiles.timezone` fails for any reason
- **THEN** the error is caught and the page still renders normally

### Requirement: Hourly reminder cron schedule
The prediction reminder cron (`/api/cron/prediction-reminders`) and the quiz reminder cron (`/api/cron/quiz-reminders`) SHALL be scheduled to run hourly (`0 * * * *`) in `vercel.json`, replacing their previous fixed daily UTC times. The cron route contract SHALL be unchanged: each route MUST keep its `CRON_SECRET` Bearer authorization, its `recordRun` wrapping, and its behavior of returning a zero summary (never an unhandled 500) when dispatch fails. The non-reminder crons (`sync-matches`, `sync-news`) MUST be left unchanged.

#### Scenario: Reminder crons run every hour
- **WHEN** the deployed `vercel.json` cron schedule is read
- **THEN** both `/api/cron/prediction-reminders` and `/api/cron/quiz-reminders` are scheduled at `0 * * * *`
- **AND** `/api/cron/sync-matches` and `/api/cron/sync-news` retain their existing schedules

#### Scenario: Unauthorized hourly invocation is rejected
- **WHEN** a reminder cron route is called without the correct `Bearer ${CRON_SECRET}` and a `CRON_SECRET` is configured
- **THEN** the route responds 401 and no dispatch runs

### Requirement: Local-7am bucketing of recipients
On each hourly run, the dispatcher SHALL email a user only when the run's current time is approximately 7am in that user's timezone. The dispatcher SHALL read each opted-in user's `profiles.timezone` (added to the `loadOptedInProfiles` select) and compute the user's current local hour from that zone using an `Intl.DateTimeFormat`-based hour computation (the same primitive family as `localDateKey`). A user SHALL be eligible on a run when their current local hour equals the target hour (7). The bucketing decision SHALL be implemented as a pure, exported, unit-testable function over the recipient set and the current time, mirroring the existing `computePending*` helpers.

#### Scenario: User emailed at their local 7am
- **WHEN** an hourly run executes and an opted-in, otherwise-eligible user's current local hour in their `profiles.timezone` is 7
- **THEN** that user is included in the recipient set for this run

#### Scenario: User not emailed outside their local 7am
- **WHEN** an hourly run executes and an opted-in user's current local hour in their `profiles.timezone` is not 7
- **THEN** that user is excluded from this run's recipient set

#### Scenario: Most hours yield no bucketed recipients
- **WHEN** an hourly run executes and no opted-in eligible user is currently at their local 7am
- **THEN** the dispatcher sends nothing and returns its zero summary

### Requirement: UTC fallback for missing or invalid timezone
When a user's `profiles.timezone` is null or fails `isValidTimeZone`, the dispatcher SHALL bucket that user as if they were in UTC, so they are eligible on the run where the current UTC hour equals the target hour (7). A missing or invalid stored timezone MUST NOT cause an opted-in user to be permanently excluded from reminders.

#### Scenario: User without a stored timezone is emailed at UTC 7am
- **WHEN** an hourly run executes at 07:00 UTC and an opted-in, otherwise-eligible user has a null or invalid `profiles.timezone`
- **THEN** that user is included in this run's recipient set

#### Scenario: User without a stored timezone is not emailed off the UTC fallback hour
- **WHEN** an hourly run executes at a UTC hour other than 7 and an opted-in user has a null or invalid `profiles.timezone`
- **THEN** that user is excluded from this run's recipient set

### Requirement: At-most-once-per-day delivery preserved under hourly runs
The hourly schedule MUST NOT cause a user to receive more than one prediction reminder or more than one quiz reminder per day. The existing per-day ledgers (`prediction_reminder_log` keyed by `(user_id, reminder_date)` and `quiz_reminder_log` keyed by `(user_id, question_id)`) SHALL remain the idempotency source, unchanged. The dispatcher SHALL continue to exclude users already present in the relevant ledger and SHALL write a ledger row only after the email provider accepts the batch. All existing dispatch behavior — opt-out filtering via `email_prefs`/`isOptedIn`, pagination, batching of ≤100 via `resend.batch.send`, per-recipient fault isolation, the no-op when `RESEND_API_KEY` is unset, and the `senderMisconfigured` summary flag — SHALL be unchanged apart from the added bucketing filter.

#### Scenario: Already-reminded user is skipped on later runs the same day
- **WHEN** a user was emailed on an earlier hourly run today and the dispatcher runs again later the same UTC day
- **THEN** that user is found in the day's ledger and is not emailed again

#### Scenario: Ledger row written only after provider acceptance
- **WHEN** a bucketed user's reminder batch is sent and the email provider accepts it
- **THEN** the user's ledger row for the day is written
- **AND WHEN** the provider rejects or errors on the batch
- **THEN** no ledger row is written and the user remains eligible on a later run that same day

#### Scenario: Opt-out and dispatch invariants unchanged
- **WHEN** a user has opted out of the reminder type via `email_prefs`
- **THEN** they are excluded regardless of bucketing
- **AND WHEN** `RESEND_API_KEY` is unset
- **THEN** the dispatcher no-ops and sends nothing
