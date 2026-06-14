# daily-quiz-email

## Purpose

Provide a scheduled, once-per-day, at-most-once email that reminds each opted-in user who has not yet answered the day's active quiz question to go answer it. The reminder deep links to the public quiz route, may surface the recipient's current answer streak as best-effort copy, and carries a one-click unsubscribe link so users can opt out without signing in.

## Requirements

### Requirement: Daily cron dispatches quiz reminder emails

The system SHALL expose an authenticated cron route at `/api/cron/quiz-reminders`
that, when invoked, dispatches the day's quiz reminder emails. A `vercel.json`
cron entry SHALL invoke this route once per day at a fixed UTC time. The route
SHALL authenticate the same way as the existing cron routes — requiring
`Authorization: Bearer ${CRON_SECRET}` when `CRON_SECRET` is configured — and
SHALL be resilient to long runs (an explicit `maxDuration`). Dispatch failures
SHALL be logged and SHALL NOT cause the route to return a server error to the
caller; the route SHALL return a JSON summary of the run.

#### Scenario: Authorized invocation runs dispatch

- **WHEN** `/api/cron/quiz-reminders` is called with a valid `Bearer ${CRON_SECRET}` header
- **THEN** the quiz reminder dispatch runs
- **AND** the response is a JSON summary including counts of emailed, skipped, and failed recipients

#### Scenario: Unauthorized invocation is rejected

- **WHEN** `CRON_SECRET` is configured and the route is called without a matching `Bearer` token
- **THEN** the route returns `401` and no emails are sent

#### Scenario: Scheduled daily by Vercel cron

- **WHEN** `vercel.json` is read
- **THEN** it contains a cron entry whose `path` is `/api/cron/quiz-reminders` and whose `schedule` fires once per day (UTC)

### Requirement: Only eligible users are emailed

A user SHALL receive the day's reminder only if ALL of the following hold for the
day's active quiz question: the user has NOT answered it, the user has NOT already
been sent a reminder for it, and the user has NOT opted out of quiz reminders.
When there is no active quiz question for the current UTC day, the dispatch SHALL
send nothing and report a zero/empty summary.

#### Scenario: Unanswered, not-yet-emailed, opted-in user is included

- **WHEN** dispatch runs and a user has no `quiz_answers` row for today's question, no reminder-ledger row for it, and `quiz_reminder_opt_out = false`
- **THEN** that user is emailed the reminder

#### Scenario: User who already answered is excluded

- **WHEN** a user has a `quiz_answers` row for today's active question
- **THEN** that user is NOT emailed

#### Scenario: Opted-out user is excluded

- **WHEN** a user has `quiz_reminder_opt_out = true`
- **THEN** that user is NOT emailed regardless of answer state

#### Scenario: No active question is a no-op

- **WHEN** dispatch runs on a UTC day with no `quiz_questions` row whose `active_on` equals today
- **THEN** no email is sent and the summary reports zero emailed

### Requirement: At-most-once delivery per user per day

The system SHALL maintain a `quiz_reminder_log` ledger keyed by `(user_id,
question_id)` so that the **automatic (cron) dispatch** emails a user at most
once per question (and thus per UTC day). A ledger row SHALL be written only
after the corresponding email send succeeds. The automatic dispatch SHALL NOT
re-email users already recorded in the ledger for the day's question. An
admin-triggered **force** re-send is exempt from this exclusion and MAY re-email
already-recorded, still-unanswered users; it SHALL still upsert the ledger so
the automatic dispatch remains idempotent afterward.

#### Scenario: Automatic re-run does not duplicate

- **WHEN** the automatic dispatch has already emailed a user for today's question and the automatic dispatch runs again the same day
- **THEN** that user is not emailed a second time

#### Scenario: Ledger row written after successful send

- **WHEN** a reminder email to a user is accepted by the email provider
- **THEN** a `quiz_reminder_log` row for `(user_id, today's question_id)` exists afterward

#### Scenario: Failed send leaves the user pending

- **WHEN** a user's reminder send fails
- **THEN** no ledger row is written for that user
- **AND** the user remains eligible on the next run

#### Scenario: Force re-send overrides the ledger exclusion

- **WHEN** an admin force re-send runs for today's question
- **THEN** users already recorded in the ledger for that question, who are opted in and have not answered, are emailed again
- **AND** the ledger still reflects those users afterward

### Requirement: Reminder email content deep links to the quiz

Each reminder email SHALL be rendered by a pure function (no database or network
access) in `DEFAULT_LOCALE`, and SHALL include a subject, an HTML part and a
plain-text part, and a call-to-action that deep links to the public quiz route
(`/quiz`) on the site's base URL. When the recipient has a current answer streak,
the copy MAY surface it (e.g. "keep your N-day streak alive"); computing the
streak SHALL be best-effort and SHALL NOT block or fail a send.

#### Scenario: Email links to the quiz

- **WHEN** a reminder email is rendered
- **THEN** it contains a link to the site's `/quiz` route
- **AND** it has both an HTML body and a plain-text body

#### Scenario: Rendered in the default locale

- **WHEN** a reminder email is rendered
- **THEN** its copy comes from the `quizEmail` message namespace resolved at `DEFAULT_LOCALE`

#### Scenario: Streak hook is optional

- **WHEN** a recipient's streak cannot be determined
- **THEN** the email is still sent with copy that omits the streak clause

### Requirement: Message catalog provides quiz email copy in every locale

The `quizEmail` message namespace SHALL exist in every supported locale catalog
(`messages/en.json`, `messages/es.json`, `messages/fr.json`) with matching keys,
so catalog-parity validation passes even though sends use `DEFAULT_LOCALE`.

#### Scenario: All locales carry the namespace

- **WHEN** the message catalogs are compared
- **THEN** each of en, es, and fr defines the same set of keys under `quizEmail`

### Requirement: Dispatch is gated, batched, and fault-isolated

The dispatcher SHALL no-op (send nothing, return a zero summary, raise no error)
when `RESEND_API_KEY` is unset. It SHALL send through the email provider in
batches not exceeding the provider batch limit. A failure sending to one recipient
SHALL be logged and counted but SHALL NOT abort the remaining recipients, and the
dispatcher SHALL return a summary of emailed, skipped, and failed counts.

#### Scenario: No API key is a safe no-op

- **WHEN** dispatch runs and `RESEND_API_KEY` is not configured
- **THEN** no email is sent, no error is thrown, and the summary reports zero emailed

#### Scenario: One recipient failure does not abort the run

- **WHEN** sending to one recipient fails during a multi-recipient run
- **THEN** the failure is counted in the summary
- **AND** the other eligible recipients are still emailed

#### Scenario: Large recipient sets are batched

- **WHEN** the eligible set exceeds the provider's per-call batch limit
- **THEN** sends are split into multiple batches and all eligible recipients are processed

### Requirement: Users can unsubscribe from quiz reminders

The system SHALL let a recipient stop receiving quiz reminders without signing in.
Each `profiles` row SHALL carry an opaque `unsubscribe_token`, and each reminder
email SHALL include a one-click unsubscribe link (and a `List-Unsubscribe` header)
resolving to a route that, given a valid token, sets `quiz_reminder_opt_out =
true` for that user. The operation SHALL be idempotent.

#### Scenario: Clicking unsubscribe opts the user out

- **WHEN** a recipient opens their reminder email's unsubscribe link with a valid token
- **THEN** their `quiz_reminder_opt_out` becomes `true`
- **AND** they are excluded from subsequent dispatches

#### Scenario: Unsubscribe is idempotent

- **WHEN** the unsubscribe link is opened more than once for the same token
- **THEN** the user remains opted out and no error is surfaced

#### Scenario: Email advertises unsubscribe to mailbox providers

- **WHEN** a reminder email is sent
- **THEN** it includes a `List-Unsubscribe` header pointing at the unsubscribe URL

### Requirement: Admin can re-send the day's quiz reminder on demand

The system SHALL provide an admin-only control in the admin area that, when
activated, dispatches the day's quiz reminder email immediately rather than
waiting for the daily cron. The action SHALL authorize the caller as an admin
before dispatching and SHALL reject non-admin callers. This manual path SHALL
perform a **force** dispatch: it bypasses the at-most-once ledger exclusion and
therefore MAY re-email opted-in, still-unanswered users who were already
reminded for the day's question. All other eligibility rules SHALL still
apply — opted-out users and users who have already answered the day's active
question SHALL NOT be emailed, and when there is no active question for the
current UTC day the action SHALL send nothing. After dispatch the action SHALL
return a summary of emailed, skipped, and failed counts for the admin to see,
and SHALL be subject to the same provider gating as the cron (a no-op when
`RESEND_API_KEY` is unset).

#### Scenario: Admin triggers an on-demand re-send

- **WHEN** an authenticated admin activates the re-send control and an active quiz question exists for the current UTC day
- **THEN** the day's quiz reminder is dispatched immediately
- **AND** the admin is shown a summary including emailed, skipped, and failed counts

#### Scenario: Force re-send reaches already-reminded but unanswered users

- **WHEN** an admin re-sends and a user is opted in, has not answered today's active question, but already has a `quiz_reminder_log` row for it
- **THEN** that user is emailed again
- **AND** the ledger remains recorded for that user

#### Scenario: Answered and opted-out users are still excluded on re-send

- **WHEN** an admin re-sends and a user has either answered today's active question or has `quiz_reminder_opt_out = true`
- **THEN** that user is NOT emailed

#### Scenario: Non-admin cannot re-send

- **WHEN** a caller who is not an admin attempts the re-send action
- **THEN** the action is rejected and no emails are sent

#### Scenario: Re-send with no active question is a no-op

- **WHEN** an admin re-sends on a UTC day with no `quiz_questions` row whose `active_on` equals today
- **THEN** no email is sent and the summary reports zero emailed
