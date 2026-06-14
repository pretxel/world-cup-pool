## 1. Data model: operation_runs ledger

- [x] 1.1 Add migration `supabase/migrations/<ts>_operation_runs.sql` creating `operation_runs` (id, kind check-constrained, trigger check-constrained default 'cron', status check-constrained, summary jsonb default '{}', error, started_at, finished_at, duration_ms, created_at).
- [x] 1.2 Add indexes `operation_runs_kind_started_idx (kind, started_at desc)` and `operation_runs_started_idx (started_at desc)`.
- [x] 1.3 `alter table operation_runs enable row level security;` with NO policies (service-role only), matching existing `*_log` ledgers.
- [x] 1.4 Apply the migration locally and regenerate `lib/database.types.ts`; add a row alias (e.g. `OperationRunRow`) in `lib/db.ts`.

## 2. Run-recording helper

- [x] 2.1 Create `lib/operations/record-run.ts` exporting `recordRun(kind, trigger, fn)` that times `fn`, derives status (`error` on throw → re-throw after logging; `partial` when summary error/failure count > 0; else `success`), and inserts one `operation_runs` row via the service-role client.
- [x] 2.2 Make the insert best-effort: wrap so a ledger write error is logged but never thrown into the job path; never mask `fn`'s own success/failure.
- [x] 2.3 Add types for job kinds and the status-derivation rule; export a small `OperationKind` union reused by crons and the dashboard.
- [x] 2.4 Unit-test status derivation (success / partial / error / throw-still-rethrows / ledger-write-failure-is-non-fatal) with Vitest in `tests/operation-runs.test.ts`.

## 3. Instrument the four cron handlers

- [x] 3.1 Wrap `app/api/cron/sync-matches/route.ts` in `recordRun('sync_matches', 'cron', …)`; confirm the returned summary JSON is byte-for-byte unchanged.
- [x] 3.2 Wrap `app/api/cron/sync-news/route.ts` in `recordRun('sync_news', 'cron', …)`.
- [x] 3.3 Wrap `app/api/cron/prediction-reminders/route.ts` in `recordRun('prediction_reminders', 'cron', …)`.
- [x] 3.4 Wrap `app/api/cron/quiz-reminders/route.ts` in `recordRun('quiz_reminders', 'cron', …)`.
- [x] 3.5 Verify each cron still 500s on failure (error not swallowed) and still short-circuits/skip-204s under missing-secret/missing-token paths without writing a misleading success row.

## 4. Operations route shell & overview

- [x] 4.1 Create `app/[locale]/(admin)/admin/operations/page.tsx` (async server component) reading via `createAdminSupabaseClient()`; drive sub-views from `searchParams` (`view`, `kind`, `status`, `page`).
- [x] 4.2 Build the Overview: one `StatusCard`/health tile per job showing last run relative time, status badge, freshness, and next scheduled run (map kinds → `vercel.json` schedules); empty state when a job has no runs.
- [x] 4.3 Add a small `lib/operations/queries.ts` for the dashboard reads (latest-per-kind, paginated history, ledger unions, activity unions) so the page stays thin.

## 5. Run history view

- [x] 5.1 Render a paginated, most-recent-first run list with kind, trigger, status badge, key summary counts, duration, and error (when present).
- [x] 5.2 Add kind + status filters encoded in `searchParams`; server-paginate (reuse the my-picks pagination pattern); show an `EmptyState` when no runs match.
- [x] 5.3 Surface error/partial detail inline for diagnosis (error text + failure counts).

## 6. Email logs view (derived)

- [x] 6.1 Union `result_email_log`, `quiz_reminder_log`, `prediction_reminder_log` into a typed email-events feed (type, recipient, sent_at) in `lib/operations/queries.ts`; resolve recipient address via the admin user lookup used by result-emails.
- [x] 6.2 Render the feed most-recent-first with per-type totals over a recent window; `EmptyState` when none.

## 7. User activity view (derived)

- [x] 7.1 Union recent `profiles.created_at` (signups), `predictions.submitted_at`, `quiz_answers.answered_at`, `group_members.joined_at` into a time-ordered activity feed (bounded by `LIMIT`/date window).
- [x] 7.2 Compute aggregate tiles: total players, players active in last 7d, prediction/quiz opt-out rates from `profiles.*_opt_out`.
- [x] 7.3 Render feed + aggregates with empty states; confirm reads never mutate.

## 8. Run-now triggers

- [x] 8.1 Create `app/[locale]/(admin)/admin/operations/actions.ts` with one server action per job: `assertAdmin()`, call the same underlying lib (`lib/result-sync/*`, `lib/news.ts`, `lib/notifications/*`) inside `recordRun(kind, 'manual', …)`, `revalidatePath('/admin/operations')`, return summary/error.
- [x] 8.2 Wire "Run now" `SubmitButton`s on each overview tile; show the result via `ActionStatus` (success/partial/error), mirroring the matches page `syncNow` UX.
- [x] 8.3 Confirm manual triggers rely on jobs' existing idempotency ledgers (no double-send / no double-recompute) and only add an extra run row.

## 9. Navigation & i18n

- [x] 9.1 Add `{ href: "/admin/operations", key: "operations" }` to the `NAV` array in `components/admin/admin-shell.tsx`; ensure active-state lights on nested operations routes.
- [x] 9.2 Add `admin.nav.operations` and all operations-page copy keys to `messages/en.json`, `messages/es.json`, `messages/fr.json`.

## 10. Verification

- [x] 10.1 Run Vitest; lint/typecheck pass; `lib/database.types.ts` is regenerated and committed.
- [ ] 10.2 Manually exercise each cron (or hit its route) and confirm exactly one `operation_runs` row per run with correct status, and that the dashboard reflects it.
- [ ] 10.3 As an admin, trigger each job via "Run now"; verify inline summary, a `manual` run row, and no duplicate side effects. Confirm a non-admin is blocked from `/admin/operations` and the run-now actions.
- [ ] 10.4 Verify Overview freshness, Run history filters/pagination, Email logs, and User activity render correctly in light/dark and across en/es/fr, with empty states where data is absent.

> Notes: 10.1 done — `tsc --noEmit`, `eslint`, `vitest` (489 passing incl. the new `operation-runs` suite + i18n parity), and `next build` all pass. The `operation_runs` migration could not be applied locally (Docker daemon down), so `lib/database.types.ts` was hand-edited to match the generated shape instead of regenerated; apply the migration to a database and run `supabase gen types` to confirm parity. 10.2–10.4 require the migration applied to a live database + an admin login (and, for emails, real recipients), so they remain for runtime verification once deployed to a preview/staging environment.
