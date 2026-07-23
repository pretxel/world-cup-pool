## ADDED Requirements

### Requirement: Announcement broadcast is an on-demand manual-only job

The operations control room SHALL register the announcement broadcast as an
`announcement_email` job that is **manual-only** (no cron schedule): its overview tile shows a
"Run now" trigger and a "manual only" indication in place of a next-run time, and its manual
run records exactly one `operation_runs` row with `trigger = "manual"` and the broadcast's
summary counts, exactly like the existing winners-email job. The `operation_runs` ledger MUST
accept the `announcement_email` kind. Because a manual run of a broadcast can re-send if
uncontrolled, the job MUST rely on its own send ledger for at-most-once delivery so a repeat
"Run now" does not re-notify players already reached.

#### Scenario: Announcement job appears as a manual-only tile

- **WHEN** an admin opens the operations overview
- **THEN** an `announcement_email` tile is shown with a "Run now" trigger, a "manual only"
  indication instead of a next scheduled run, and no pause/resume control

#### Scenario: Manual run is recorded and summarized

- **WHEN** an admin presses "Run now" on the announcement job and authorization passes
- **THEN** the broadcast runs, one `operation_runs` row is written with `trigger = "manual"`
  and the `announcement_email` kind, and the summary (recipients / emailed / failed / skipped)
  is shown inline

#### Scenario: Repeat run does not re-notify

- **WHEN** an admin presses "Run now" again after a prior successful broadcast
- **THEN** the job's send ledger excludes already-notified players, so only newly-eligible
  players are emailed and an additional run record is produced

#### Scenario: Trigger rejected for non-admin

- **WHEN** a non-admin attempts to invoke the announcement run-now action
- **THEN** the action's admin assertion rejects it and no broadcast runs and no run record is
  written
