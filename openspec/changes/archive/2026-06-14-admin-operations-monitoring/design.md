## Context

The admin area already has a clean, extensible shape: a `(admin)` route group whose `layout.tsx` enforces `is_admin`, a single-source `NAV` array in `components/admin/admin-shell.tsx`, shared presentational primitives (`AdminPageHeader`, `StatusCard`, `ActionStatus`, `SubmitButton`, `EmptyState`), and server actions that read/write through `createAdminSupabaseClient()` (service role) after an `assertAdmin()` guard.

Four background jobs run on Vercel cron (schedules in `vercel.json`):

| Cron | Schedule (UTC) | Existing summary object |
| --- | --- | --- |
| `sync-matches` | `0 9 * * *` | `{ fetched, matched, live, final, recomputed, unmatched, errors, source, stale, staleResolved, emailed }` |
| `sync-news` | `0 7 * * *` | `{ fetched, inserted, updated, skipped, errors }` |
| `prediction-reminders` | `0 12 * * *` | `{ emailed, failed, skipped }` |
| `quiz-reminders` | `0 13 * * *` | `{ emailed, failed, skipped }` |

Each returns a rich summary but **persists nothing** — runs vanish into console logs. Email sends leave at-most-once ledgers (`result_email_log`, `quiz_reminder_log`, `prediction_reminder_log`) keyed for idempotency, not observability (no recipient address, no failure rows). User activity is implicit in `predictions.submitted_at`, `quiz_answers.answered_at`, `group_members.joined_at`, and `profiles.created_at`.

The owner spends real operational time here and currently flies blind. This design adds the minimum durable trace plus a read-mostly dashboard.

## Goals / Non-Goals

**Goals:**
- One durable record per background-job run, written on success *and* failure, with enough structure to render history, status, duration, and counts.
- An `/admin/operations` control room: at-a-glance health, full run history, email-dispatch logs, and user-activity signals.
- On-demand "Run now" triggers that reuse existing job logic and feed the same ledger.
- Zero behavioral change to the public app, scoring, providers, or player-facing RLS.

**Non-Goals:**
- A dedicated per-recipient `email_log` table or Resend delivery/bounce/open webhooks (deferred; email logs are derived from the existing ledgers).
- Login/session tracking (Supabase `auth.audit_log_entries` is not exposed to app RLS; out of scope).
- Real-time streaming/live updates — the dashboard is request-time reads with manual refresh.
- Editing/deleting historical runs; the ledger is append-only.

## Decisions

### D1 — One generic `operation_runs` table, not per-job tables
A single append-only table keyed by `kind` keeps the schema small and the dashboard query uniform. The variable per-job counts live in a `summary jsonb` column rather than typed columns, so adding a future job needs no migration.

```sql
create table public.operation_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'sync_matches','sync_news','prediction_reminders','quiz_reminders')),
  trigger text not null default 'cron' check (trigger in ('cron','manual')),
  status text not null check (status in ('success','partial','error')),
  summary jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index operation_runs_kind_started_idx on public.operation_runs (kind, started_at desc);
create index operation_runs_started_idx on public.operation_runs (started_at desc);
```

- **`trigger`** distinguishes scheduled runs from admin "Run now" presses.
- **`status`**: `success` = no errors; `partial` = completed but `errors > 0` / some sends failed; `error` = threw before/while running.
- **RLS**: enable RLS, **no policies** → only the service-role client (crons + admin actions) can touch it, matching the existing `*_log` ledgers. Admin reads go through `createAdminSupabaseClient()`, consistent with the rest of the admin area.

*Alternative considered:* per-job typed columns — rejected: schema churn per new job, wider migrations, no real query benefit at this scale. *Alternative:* reuse Vercel's built-in cron observability — rejected: not queryable from the app, no manual-trigger story, vendor-coupled.

### D2 — A `recordRun()` wrapper instruments crons without rewriting them
Add `lib/operations/record-run.ts` exporting a higher-order helper that times the job, derives `status` from the returned summary (or a thrown error), and inserts one `operation_runs` row. Each cron handler changes from "compute summary → return" to "wrap compute in `recordRun(kind, trigger, fn)` → return". The job's own logic is untouched; instrumentation is a thin, uniform seam.

```ts
// shape
recordRun(kind, trigger, async () => existingSummary): Promise<{ summary, status, runId }>
```

The helper decides `status`: `error` on throw (re-thrown after logging so cron still 500s), else `partial` when the summary's error/failure count is > 0, else `success`. Writing the row must never mask a job failure — the insert is best-effort and wrapped so a ledger write error is logged but not fatal.

*Alternative considered:* inline insert in each handler — rejected: four divergent copies of status logic; the wrapper keeps it in one tested place.

### D3 — Email logs and user activity are DERIVED, no new tables
- **Email logs** read the three existing ledgers. Each ledger row already has `sent_at` and the keys to join a recipient (`user_id` → `profiles`/`auth.users` for the address, `match_id`/`question_id`/`reminder_date` for context). The Emails view unions them into a typed "email events" feed with type, recipient, timestamp, and per-type counts.
- **User activity** unions recent `profiles.created_at` (signups), `predictions.submitted_at`, `quiz_answers.answered_at`, and `group_members.joined_at` into an activity feed, plus aggregate tiles (total players, active in last 7d, opt-out rates from `profiles.*_opt_out`).

This honors the "Hybrid" decision: real run history for syncs (which had none), derived views for emails/activity (which existing data already supports). Recipient email comes from `auth.users` via the admin client's user lookup, the same path result-emails already use.

*Alternative considered:* full per-recipient `email_log` + Resend webhooks — explicitly deferred (see Non-Goals) to keep this change one migration.

### D4 — `/admin/operations` is one route with tabbed sub-views
A single `operations/page.tsx` server component renders an Overview plus tab panels (Runs, Emails, Activity), each a server-rendered section reading via the admin client. Tabs use `searchParams` (e.g. `?view=runs&kind=sync_news&page=2`) so views are linkable, server-paginated, and need no client data-fetching — matching the app's RSC-first, `searchParams`-driven patterns (e.g. my-picks pagination). Run-now actions live in `operations/actions.ts`.

*Alternative considered:* four separate routes — rejected: more nav noise; the operations concern reads as one screen with facets.

### D5 — "Run now" reuses job libraries and the same ledger
Each trigger is a server action that `assertAdmin()`s, calls the *same* underlying function the cron calls (`lib/result-sync/*`, `lib/news.ts`, `lib/notifications/*`), wraps it in `recordRun(kind, 'manual', …)`, revalidates `/admin/operations`, and surfaces the summary via `ActionStatus` — exactly the proven pattern from the matches page's `syncNow`. Idempotency is already handled by the jobs' own ledgers (e.g. result/reminder emails won't double-send), so manual triggers are safe to press.

*Risk note:* a manual run that overlaps a cron run is safe (idempotent ledgers, `.neq('status','final')` write guards) but could produce two rows for the same window — acceptable and even useful for observability.

## Risks / Trade-offs

- **Unbounded ledger growth** → low volume (≤ a handful of runs/day) makes this negligible for the tournament window; if needed, a future retention job can prune rows older than N days. Indexed by `(kind, started_at desc)` so reads stay fast regardless.
- **Ledger write fails / partial instrumentation** → the wrapper's insert is best-effort and never throws into the job path; a missing row degrades observability only, never job correctness.
- **Recipient email exposure in the admin UI** → addresses are already visible to the admin elsewhere; the Emails view is behind the same `is_admin` layout gate and service-role read. No new exposure surface to non-admins.
- **Derived activity queries scan player tables** → bounded with `LIMIT`/date windows and existing indexes (`predictions_user_id_idx`, `quiz_answers_*`, `group_members_user_id_idx`); aggregates are simple counts. Acceptable at current scale.
- **Manual trigger abuse / accidental double-press** → `SubmitButton` pending state + jobs' own idempotency ledgers prevent duplicate side effects; only extra `operation_runs` rows result.

## Migration Plan

1. Add migration `supabase/migrations/<ts>_operation_runs.sql` (table + indexes + `enable row level security`, no policies). Regenerate `lib/database.types.ts`.
2. Add `lib/operations/record-run.ts` (+ types) and unit-test the status-derivation logic with Vitest.
3. Wrap the four cron handlers in `recordRun(...)`; verify returned summaries are unchanged.
4. Build `/admin/operations` route, sub-views, and `actions.ts` triggers; reuse admin primitives.
5. Add `operations` to the `NAV` array and i18n keys to `messages/{en,es,fr}.json`.
6. Deploy. **Rollback**: revert the route + nav + cron wrappers; the table can stay (inert, append-only) or be dropped in a follow-up `drop table` migration. No data migration is required since the table starts empty and nothing else depends on it.

## Open Questions

- Retention: keep all runs for the tournament, or add a prune-after-N-days job now? (Default: keep; revisit if volume surprises.)
- Should "Run now" be allowed for reminder jobs outside their natural daily window, or guarded to avoid off-hours emails? (Default: allow, since ledgers prevent duplicates; reconsider if the owner wants a confirm gate.)
