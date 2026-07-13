# Delta: admin-operations-monitoring

## ADDED Requirements

### Requirement: Scheduled jobs have a persisted enablement setting

Each background job SHALL have a persisted per-kind enablement setting, stored in an `operation_settings` table keyed by job kind, defaulting to enabled when no row exists. The table MUST be protected like `operation_runs`: row-level security enabled with no client policies, so only the service-role client used by crons and admin code can read or write it.

#### Scenario: Absent setting means enabled

- **WHEN** a job kind has no `operation_settings` row
- **THEN** the job is treated as enabled everywhere the setting is consulted

#### Scenario: Non-admin cannot read or write settings

- **WHEN** a signed-in non-admin or anonymous user attempts to read or modify `operation_settings` through a normal client
- **THEN** row-level security denies the access (no policies grant it)

### Requirement: Disabled jobs skip their cron invocation

A cron route whose job is disabled SHALL, after passing authorization, return the existing skip response (`204` with an `x-skipped: disabled` header) without executing the job body and without writing an `operation_runs` row. If reading the enablement setting fails, the route MUST fail open: log the failure and run the job as if enabled, so a settings-store outage cannot silently halt all scheduled work.

#### Scenario: Cron fires while job is disabled

- **WHEN** a scheduled cron invocation reaches a route whose job is disabled
- **THEN** the route responds `204` with `x-skipped: disabled`
- **AND** the job body does not execute (no sync, no emails) and no run record is written

#### Scenario: Cron fires while job is enabled

- **WHEN** a scheduled cron invocation reaches a route whose job is enabled (explicitly or by default)
- **THEN** the route behaves exactly as before this change (auth, env gates, job, recorded run)

#### Scenario: Settings read fails

- **WHEN** the enablement lookup errors or throws during a cron invocation
- **THEN** the failure is logged and the job runs as if enabled

### Requirement: Admins can pause and resume scheduled jobs

The operations overview SHALL let an admin toggle each scheduled job between enabled and paused via an admin-only action that persists the setting and refreshes the overview. A paused job's tile MUST show a clear paused indication and replace its next-run time with a paused label, while its "Run now" trigger remains available and functional — a manual run bypasses the pause. Manual-only jobs with no cron schedule MUST NOT show a pause toggle.

#### Scenario: Admin pauses a scheduled job

- **WHEN** an admin uses the pause control on a scheduled job's tile
- **THEN** the setting is persisted as disabled, the overview reflects a paused state on that tile, and the next-run display indicates the job is paused

#### Scenario: Admin resumes a paused job

- **WHEN** an admin uses the resume control on a paused job's tile
- **THEN** the setting is persisted as enabled and the tile again shows the next scheduled run

#### Scenario: Manual run while paused

- **WHEN** an admin presses "Run now" on a paused job
- **THEN** the job runs normally and records a `manual` run, exactly as when enabled

#### Scenario: Manual-only job has no toggle

- **WHEN** an admin views the tile of a job with no cron schedule
- **THEN** no pause/resume control is rendered for it

#### Scenario: Toggle rejected for non-admin

- **WHEN** a non-admin attempts to invoke the toggle action
- **THEN** the admin assertion rejects it and no setting is written
