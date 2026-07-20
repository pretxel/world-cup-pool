-- ===========================================================================
-- Pool winners congratulation email — send-once ledger + operation kind
-- ---------------------------------------------------------------------------
-- An admin-triggered, one-off email congratulates the final podium (overall
-- leaderboard rank ≤ 3, ties included) once the competition is settled. Like
-- score_rules_email_log there is no date dimension: a winner is "pending"
-- while opted-in with NO row here. The row is written only after Resend
-- accepts the message, so the ledger gives at-most-once delivery per player
-- and a failed/partial run leaves the remainder pending for the next run.
--
-- Purely additive. Written/read exclusively by the service-role admin client —
-- RLS is enabled with no policies, so no anon/authenticated access. Same
-- posture as public.score_rules_email_log.
-- ===========================================================================

create table public.winners_email_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.winners_email_log enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same posture as public.score_rules_email_log.

-- ---------------------------------------------------------------------------
-- Allow the new operation kind in the operation_runs ledger so the manual run
-- surfaces in the admin operations control room alongside the existing jobs.
-- Drop + recreate the CHECK constraint with the added value.
-- ---------------------------------------------------------------------------
alter table public.operation_runs
  drop constraint operation_runs_kind_check;
alter table public.operation_runs
  add constraint operation_runs_kind_check check (kind in (
    'sync_matches', 'sync_news', 'prediction_reminders', 'quiz_reminders',
    'results_digest', 'recap_digest', 'comeback_emails', 'playoff_score_email',
    'score_rules_email', 'winners_email'
  ));
