-- ===========================================================================
-- Operation settings — per-job cron kill switch
-- ---------------------------------------------------------------------------
-- Vercel cron schedules live in vercel.json and cannot be toggled at runtime;
-- pausing a job used to require a redeploy. This table lets the admin pause a
-- scheduled job from the operations control room: the cron still fires, but
-- the route consults its row here and skips (204 x-skipped: disabled) when
-- enabled = false.
--
-- One row per job kind, and an ABSENT row means enabled — no seeding needed,
-- and a future job kind is automatically on. Manual "Run now" ignores this
-- table: pausing stops the schedule, not the admin's ability to run by hand.
--
-- Posture mirrors public.operation_runs: RLS enabled with NO policies, so only
-- the service-role key (crons + admin actions, which bypass RLS) can read or
-- write it. Admin reads go through the service-role admin client behind the
-- is_admin layout gate.
-- ===========================================================================

create table public.operation_settings (
  -- Which background job the switch controls. Constrained so a typo can't
  -- create a phantom kind, same as operation_runs.kind.
  kind text primary key check (kind in (
    'sync_matches', 'sync_news', 'prediction_reminders', 'quiz_reminders',
    'results_digest', 'recap_digest', 'comeback_emails',
    'playoff_score_email', 'score_rules_email'
  )),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.operation_settings enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- these switches. Same posture as public.operation_runs.
