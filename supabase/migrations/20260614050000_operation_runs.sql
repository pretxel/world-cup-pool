-- ===========================================================================
-- Operation runs ledger — durable history for background jobs
-- ---------------------------------------------------------------------------
-- The four background jobs (sync-matches, sync-news, prediction-reminders,
-- quiz-reminders) run on Vercel cron and, until now, log only to the server
-- console: every run vanishes. The admin operations control room needs a
-- queryable trace, so each job records exactly one row here per execution —
-- whether fired by cron or by an admin "Run now", and whether it succeeds or
-- fails.
--
-- One generic table keyed by `kind` keeps the schema small and the dashboard
-- query uniform; the variable per-job counts live in `summary` (jsonb) so a
-- future job needs no migration. Append-only.
--
-- Posture mirrors the existing *_log ledgers: RLS enabled with NO policies, so
-- only the service-role key (crons + admin actions, which bypass RLS) can read
-- or write it. Admin reads go through the service-role admin client behind the
-- is_admin layout gate.
-- ===========================================================================

create table public.operation_runs (
  id uuid primary key default gen_random_uuid(),
  -- Which background job ran. Constrained so a typo can't create a phantom kind
  -- the dashboard never surfaces.
  kind text not null check (kind in (
    'sync_matches', 'sync_news', 'prediction_reminders', 'quiz_reminders'
  )),
  -- How the run was started: the daily schedule, or an admin pressing "Run now".
  trigger text not null default 'cron' check (trigger in ('cron', 'manual')),
  -- Derived outcome: success = no errors; partial = completed but the summary
  -- reported a non-zero error/failure count; error = the job threw.
  status text not null check (status in ('success', 'partial', 'error')),
  -- The job's own summary object (counts), stored verbatim for the run detail.
  summary jsonb not null default '{}'::jsonb,
  -- Populated only for status='error': the thrown message.
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- Wall-clock duration in milliseconds, stamped when the run finishes.
  duration_ms integer,
  created_at timestamptz not null default now()
);

-- History is read most-recent-first, both globally and filtered to one kind.
create index operation_runs_kind_started_idx
  on public.operation_runs (kind, started_at desc);
create index operation_runs_started_idx
  on public.operation_runs (started_at desc);

alter table public.operation_runs enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same "service-role only" posture as public.result_email_log /
-- public.prediction_reminder_log / public.quiz_reminder_log.
