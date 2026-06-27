## MODIFIED Requirements

### Requirement: Operations overview shows per-job health

The operations overview SHALL present one health tile per background job showing its last run time, last run status, an at-a-glance freshness indication (how long since the data was last synced/dispatched), and its next scheduled run. For a **manual-only** job that has no cron schedule, the tile SHALL indicate that it is manual-only (in place of a next-run time) rather than computing or showing a scheduled time. When a job has never run, the tile MUST show a clear empty state rather than an error.

#### Scenario: Tile reflects the latest run

- **WHEN** an admin opens the operations overview and a job has prior runs
- **THEN** that job's tile shows the most recent run's relative time, a status badge, freshness, and the next scheduled run time

#### Scenario: Manual-only job shows no scheduled run

- **WHEN** an admin opens the operations overview and a job has no cron schedule (manual-only)
- **THEN** that job's tile shows a "manual only" indication instead of a next scheduled run, and still offers its "Run now" trigger

#### Scenario: Job with no history shows an empty state

- **WHEN** a job has no recorded runs yet
- **THEN** its tile shows a "no runs yet" empty state instead of stale or error content
