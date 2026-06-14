## Why

The pool owner operates the product daily — syncing scores, syncing news, and dispatching reminder/result emails — but the admin area is **operationally blind**. Every cron (`sync-matches`, `sync-news`, `prediction-reminders`, `quiz-reminders`) runs, logs to the server console, and forgets: there is no persisted run history, so the owner cannot answer "did news sync today?", "why did the score sync fail?", "how many emails went out?", or "who is actually playing?" without SSH-ing into logs. This change gives the admin a single operations control room to observe runs, emails, and user activity, and to trigger jobs on demand.

## What Changes

- **New `operation_runs` ledger** — a single table capturing one row per cron/job execution: kind, status (`success` | `partial` | `error`), a JSON summary of counts, an error message, and start/finish timestamps for duration.
- **Instrument the four cron handlers** (`sync-matches`, `sync-news`, `prediction-reminders`, `quiz-reminders`) to record an `operation_runs` row on every run (success or failure), wrapping their existing summary objects. No change to what the crons *do* — only that they now leave a trace.
- **New admin section `/admin/operations`** with:
  - **Overview** — health tiles per operation: last run time, last status, freshness ("scores synced 2h ago"), next scheduled run.
  - **Operation runs** — paginated run history across all kinds with status badges, counts, errors, and duration; filterable by kind/status.
  - **Email logs** — surfaced from existing ledgers (`result_email_log`, `quiz_reminder_log`, `prediction_reminder_log`): how many emails of each type went out, to whom, when.
  - **User activity** — derived from existing tables: recent signups, predictions, quiz answers, group joins; engagement counts (active players, opt-out rates).
- **Run-now triggers** — each operation card gets a "Run now" admin action that reuses the existing sync/notify libraries, records an `operation_runs` row, and shows the summary inline (mirrors the matches page's existing `syncNow`).
- **Admin nav gains an "Operations" entry**; i18n keys added to `messages/{en,es,fr}.json`.

No change to the public app, scoring, RLS for player data, auth model, or external providers. The crons' behavior is unchanged apart from recording their own runs.

## Capabilities

### New Capabilities
- `admin-operations-monitoring`: An admin operations control room — persists one run record per background job, exposes a dashboard to observe run history, email dispatch logs, sync freshness, and user-activity signals, and lets admins trigger syncs/jobs on demand. Owns the requirement that background jobs record their runs.

### Modified Capabilities
<!-- None at the spec level. The cron capabilities (automated-results, news,
     result-email-notifications, prediction-reminder-email, daily-quiz-email)
     keep their existing behavior; the new run-recording requirement lives in
     the admin-operations-monitoring spec, which references the jobs it observes. -->

## Impact

- **Database**: new migration adding `operation_runs` (service-role write, admin read); no changes to existing tables. Regenerate `lib/database.types.ts`.
- **Crons**: `app/api/cron/{sync-matches,sync-news,prediction-reminders,quiz-reminders}/route.ts` wrap their run in a record-on-finish helper (new `lib/operations/record-run.ts`).
- **Routes (new)**: `app/[locale]/(admin)/admin/operations/{page.tsx,actions.ts}` plus sub-views/components.
- **Nav**: `components/admin/admin-shell.tsx` NAV array + `AdminNav`; i18n `admin.nav.operations` and the operations page copy.
- **Reuse**: `createAdminSupabaseClient()`, `AdminPageHeader`, `StatusCard`, `ActionStatus`, `SubmitButton`, `EmptyState`; existing `lib/result-sync/*`, `lib/news.ts`, `lib/notifications/*` for triggers.
- **No impact**: public surfaces, scoring, player-facing RLS, auth, email providers, leaderboards.
