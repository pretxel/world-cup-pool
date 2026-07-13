# Tasks: admin-disable-crons

## 1. Database

- [x] 1.1 Add migration `operation_settings` (kind text PK, enabled boolean not null default true, updated_at timestamptz) with RLS enabled and no policies, mirroring `operation_runs`
- [x] 1.2 Regenerate `lib/database.types.ts` to include the new table

## 2. Settings helper

- [x] 2.1 Create `lib/operations/settings.ts` with `isOperationEnabled(kind)` (service-role read, absent row = enabled, fail-open with logging) and `getOperationSettings()` returning `Record<OperationKind, boolean>` in one query
- [x] 2.2 Add `setOperationEnabled(kind, enabled)` write helper (upsert by kind, sets `updated_at`)
- [x] 2.3 Unit tests: default-enabled on absent row, fail-open on query error, settings map fills all kinds

## 3. Cron routes

- [x] 3.1 Add the `isOperationEnabled` check (after auth, before job) returning `skipped("disabled")` in all eight routes under `app/api/cron/*/route.ts`
- [x] 3.2 Route tests: disabled kind → 204 `x-skipped: disabled`, job not invoked, no run recorded; enabled kind → unchanged behavior; settings error → job still runs

## 4. Admin UI

- [x] 4.1 Add `toggleOperationEnabled` server action in `admin/operations/actions.ts` (assertAdmin → write setting → revalidatePath → redirect back to overview, following the `trigger()` pattern)
- [x] 4.2 Overview: fetch settings once via `getOperationSettings()`; on scheduled-job tiles render Pause/Resume form button, "Paused" badge, and paused label in place of next-run time; no toggle on manual-only tiles
- [x] 4.3 Add i18n strings (pause/resume labels, paused badge/state) to `messages/{en,es,fr,de}.json` under `admin.operations`
- [x] 4.4 Test: toggle action rejects non-admin and writes nothing

## 5. Verify

- [x] 5.1 Run test suite, lint, and typecheck
- [x] 5.2 Manual pass: pause a job → tile shows paused + cron route returns 204; "Run now" still works while paused; resume restores next-run display (verified via live integration run against the local Supabase stack; UI eyeball pass pending — see session notes)
