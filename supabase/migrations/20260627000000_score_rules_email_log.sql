-- ===========================================================================
-- Scoring-rules announcement email — send-once ledger + operation kind
-- ---------------------------------------------------------------------------
-- An admin-triggered, one-off broadcast announces the stage-weighted scoring
-- rules to every opted-in player. Unlike the recurring digests there is no
-- date dimension: a player is "pending" when they are opted-in and have NO row
-- here. The row is written only after Resend accepts the batch, so the ledger
-- gives at-most-once delivery per player and survives idempotent re-runs and
-- crashes (a failed batch leaves those players pending for the next run).
--
-- Purely additive. Written/read exclusively by the service-role admin client —
-- RLS is enabled with no policies, so no anon/authenticated access. Same
-- "definer/service-role only" posture as public.playoff_score_email_log.
--
-- No backfill: shipping this feature deliberately leaves every player pending
-- so the admin's first "Run now" reaches all of them exactly once.
-- ===========================================================================

create table public.score_rules_email_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.score_rules_email_log enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same posture as public.playoff_score_email_log.

-- ---------------------------------------------------------------------------
-- Allow the new operation kind in the operation_runs ledger so the manual
-- announcement run surfaces in the admin operations control room alongside the
-- existing jobs. Drop + recreate the CHECK constraint with the added value.
-- ---------------------------------------------------------------------------
alter table public.operation_runs
  drop constraint operation_runs_kind_check;
alter table public.operation_runs
  add constraint operation_runs_kind_check check (kind in (
    'sync_matches', 'sync_news', 'prediction_reminders', 'quiz_reminders',
    'results_digest', 'recap_digest', 'comeback_emails', 'playoff_score_email',
    'score_rules_email'
  ));
