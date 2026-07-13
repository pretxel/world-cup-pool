# Proposal: admin-disable-crons

## Why

All eight scheduled jobs (score sync, news sync, and the six email dispatches) fire unconditionally on their Vercel cron schedules. The only way to stop one — e.g. to pause reminder emails during a tournament break, or halt a misbehaving sync — is to edit `vercel.json` and redeploy. The admin needs a runtime kill switch per job, controlled from the existing operations control room.

## What Changes

- Add a per-job enabled/disabled setting persisted in the database (default: enabled), keyed by `OperationKind`.
- Each cron route checks the setting after auth and before running; a disabled job skips with the existing `204 + x-skipped` pattern instead of executing.
- The admin operations overview gains a pause/resume toggle on each scheduled job's tile, plus a visible "paused" state (badge and next-run display).
- Manual "Run now" deliberately **bypasses** the toggle — disabling a cron stops the schedule, not the admin's ability to run the job by hand.
- Manual-only jobs (e.g. `score_rules_email`) have no cron, so they show no toggle.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `admin-operations-monitoring`: adds requirements for (1) a persisted per-job cron enablement setting, (2) cron routes skipping disabled jobs without executing or recording a run, and (3) admins toggling and seeing the paused state from the operations overview while manual triggers remain available.

## Impact

- **Database**: new migration for an `operation_settings` table (kind, enabled, updated_at) with RLS locked down like `operation_runs` (service-role only, no client policies).
- **Cron routes**: all eight under `app/api/cron/*/route.ts` gain an enabled-check via a shared helper in `lib/operations/`.
- **Admin UI**: `app/[locale]/(admin)/admin/operations/` — overview tiles, new server action in `actions.ts`, paused badge/state.
- **i18n**: new strings in `messages/{en,es,fr,de}.json` under `admin.operations`.
- **Types**: `lib/database.types.ts` regenerated for the new table.
- **Tests**: route skip behavior, toggle action authorization, helper default-enabled semantics.
