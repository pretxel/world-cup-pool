# admin-operations-monitoring Specification

## Purpose

Give the pool owner an admin operations control room that persists a durable record of every background-job run, surfaces email-dispatch logs and user-activity signals, and lets admins trigger syncs and jobs on demand.

## Requirements

### Requirement: Background jobs record each run

Every background job — score sync, news sync, prediction reminders, and quiz reminders — SHALL persist exactly one `operation_runs` record per execution, whether triggered by cron or manually, and whether it succeeds or fails. The record MUST capture the job kind, the trigger source (`cron` or `manual`), a derived status (`success`, `partial`, or `error`), the job's summary counts, an error message when applicable, and start/finish timestamps from which duration is computed. Recording a run MUST NOT change the job's own behavior or outputs, and a failure to write the record MUST NOT cause an otherwise-successful job to fail.

#### Scenario: Successful cron run is recorded

- **WHEN** a scheduled cron job completes without errors
- **THEN** one `operation_runs` row is written with `trigger = "cron"`, `status = "success"`, the job's summary counts in `summary`, a `finished_at`, and a computed duration
- **AND** the job's returned response is unchanged from before instrumentation

#### Scenario: Run with non-fatal errors is marked partial

- **WHEN** a job completes but its summary reports a non-zero error/failure count (e.g. some emails failed, some matches unmatched)
- **THEN** the recorded row has `status = "partial"` and the summary counts reflect the failures

#### Scenario: Failed run is recorded and still surfaces the failure

- **WHEN** a job throws before producing a summary
- **THEN** one `operation_runs` row is written with `status = "error"` and the error message captured in `error`
- **AND** the cron endpoint still reports the failure to its caller (the error is not swallowed)

#### Scenario: Ledger write failure does not break the job

- **WHEN** writing the `operation_runs` row itself fails
- **THEN** the failure is logged but the job's primary result (synced scores, sent emails) is preserved and returned normally

### Requirement: Run records are admin-only

The `operation_runs` ledger SHALL be writable only by the service-role client used by crons and admin actions, and readable only within the admin area. Non-admin and unauthenticated users MUST NOT be able to read or write run records.

#### Scenario: Non-admin cannot access run records

- **WHEN** a signed-in non-admin or anonymous user attempts to read `operation_runs` through a normal client
- **THEN** row-level security denies the read (no policies grant access)

#### Scenario: Admin reads runs through the admin client

- **WHEN** an admin views the operations dashboard
- **THEN** run records are read through the service-role admin client behind the `is_admin` layout gate

### Requirement: Operations control room is reachable from admin nav

The admin section SHALL expose an "Operations" entry in its primary navigation that links to `/admin/operations`, gated by the existing admin authorization, with its label translated in all supported locales (en/es/fr).

#### Scenario: Admin sees the Operations nav entry

- **WHEN** an admin views any admin screen
- **THEN** the nav shows an "Operations" item that routes to `/admin/operations`
- **AND** the item is highlighted as active while on any `/admin/operations` route

#### Scenario: Non-admin cannot reach the operations route

- **WHEN** a non-admin or anonymous visitor requests `/admin/operations`
- **THEN** the admin layout blocks access (redirect to sign-in or forbidden message), consistent with other admin routes

### Requirement: Operations overview shows per-job health

The operations overview SHALL present one health tile per background job showing its last run time, last run status, an at-a-glance freshness indication (how long since the data was last synced/dispatched), and its next scheduled run. When a job has never run, the tile MUST show a clear empty state rather than an error.

#### Scenario: Tile reflects the latest run

- **WHEN** an admin opens the operations overview and a job has prior runs
- **THEN** that job's tile shows the most recent run's relative time, a status badge, freshness, and the next scheduled run time

#### Scenario: Job with no history shows an empty state

- **WHEN** a job has no recorded runs yet
- **THEN** its tile shows a "no runs yet" empty state instead of stale or error content

### Requirement: Run history is browsable and filterable

The operations area SHALL provide a paginated history of recorded runs across all jobs, each entry showing kind, trigger source, status, key summary counts, error (when present), and duration. The history MUST be filterable by job kind and by status, with filter and page state reflected in the URL so views are linkable.

#### Scenario: Browse recent runs

- **WHEN** an admin opens the run history
- **THEN** runs are listed most-recent-first with status badges, counts, duration, and pagination controls

#### Scenario: Filter by kind and status

- **WHEN** an admin filters by a specific job kind and/or status
- **THEN** only matching runs are shown and the filter and page are encoded in the URL `searchParams`

#### Scenario: Inspect a failed run

- **WHEN** a listed run has `status = "error"` or `"partial"`
- **THEN** its error message and the relevant failure counts are visible for diagnosis

### Requirement: Email dispatch logs are surfaced from existing ledgers

The operations area SHALL surface email-dispatch logs derived from the existing send ledgers (result-standing, quiz-reminder, prediction-reminder), without introducing a new email table. Each entry MUST show the email type, recipient, and time sent, and the view MUST show per-type totals over a recent window.

#### Scenario: View recent email events

- **WHEN** an admin opens the email logs view
- **THEN** sent emails from all three ledgers are shown with type, recipient, and timestamp, most-recent-first
- **AND** per-type counts for the window are displayed

#### Scenario: No emails sent yet

- **WHEN** no ledger rows exist for the selected window
- **THEN** an empty state is shown rather than an error

### Requirement: User activity signals are surfaced

The operations area SHALL surface user-activity signals derived from existing tables: recent signups, predictions, quiz answers, and group joins as an activity feed, plus engagement aggregates (total players, players active in a recent window, and email opt-out rates). No new activity table is introduced.

#### Scenario: View the activity feed

- **WHEN** an admin opens the user-activity view
- **THEN** recent signups, predictions, quiz answers, and group joins are shown as a time-ordered feed
- **AND** aggregate tiles show total players, recently-active players, and opt-out rates

#### Scenario: Activity reflects only real player data

- **WHEN** activity aggregates are computed
- **THEN** they are derived from `profiles`, `predictions`, `quiz_answers`, and `group_members` and reflect current data without modifying it

### Requirement: Admins can trigger jobs on demand

Each background job SHALL be triggerable on demand from the operations area by an admin. A manual trigger MUST reuse the same underlying job logic as the cron, record an `operation_runs` row with `trigger = "manual"`, surface the run summary inline on completion, and rely on the jobs' existing idempotency so a manual run does not cause duplicate side effects.

#### Scenario: Run a sync on demand

- **WHEN** an admin presses "Run now" on a job and authorization passes
- **THEN** the job's existing logic runs, a `manual` run is recorded, and the resulting summary (or error) is shown inline via the action status panel

#### Scenario: Manual run does not double-send or corrupt state

- **WHEN** an admin triggers a reminder or result job that has already sent for the current window
- **THEN** the jobs' existing idempotency ledgers prevent duplicate emails or recomputation, and only an additional run record is produced

#### Scenario: Trigger rejected for non-admin

- **WHEN** a non-admin attempts to invoke a run-now action
- **THEN** the action's admin assertion rejects it and no job runs and no run record is written
