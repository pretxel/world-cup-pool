## ADDED Requirements

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

## MODIFIED Requirements

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
