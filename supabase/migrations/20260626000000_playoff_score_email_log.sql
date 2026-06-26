-- ===========================================================================
-- Saturday playoff-score email — dedupe ledger + operation kind
-- ---------------------------------------------------------------------------
-- A weekly Saturday cron emails every opted-in player the final scorelines of
-- that Saturday's finished knockout (playoff) matches. A (digest_date, user_id)
-- pair is "pending" when the player is opted-in and has no ledger row for the
-- day; the row is written only after Resend accepts the batch, so the ledger
-- gives at-most-once delivery per (Saturday, player) and survives idempotent
-- re-runs and crashes.
--
-- Purely additive. Written/read exclusively by the service-role admin client —
-- RLS is enabled with no policies, so no anon/authenticated access. Same
-- "definer/service-role only" posture as public.result_email_log and
-- public.results_digest_log.
-- ===========================================================================

create table public.playoff_score_email_log (
  digest_date date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (digest_date, user_id)
);
create index playoff_score_email_log_user_id_idx on public.playoff_score_email_log (user_id);

alter table public.playoff_score_email_log enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same posture as public.result_email_log / results_digest_log.

-- ---------------------------------------------------------------------------
-- Backfill: pre-mark the current UTC date as "sent" for every player so
-- shipping this feature does not blast an email for a Saturday already in
-- progress. After this, the first cron run only sends for the NEXT Saturday
-- onward (or this Saturday's later finals to players who join after deploy).
-- ---------------------------------------------------------------------------
insert into public.playoff_score_email_log (digest_date, user_id)
select (now() at time zone 'utc')::date, p.id
from public.profiles p
on conflict (digest_date, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Allow the new operation kind in the operation_runs ledger so the playoff-
-- score cron's runs surface in the admin operations control room alongside the
-- existing jobs. Drop + recreate the CHECK constraint with the added value.
-- ---------------------------------------------------------------------------
alter table public.operation_runs
  drop constraint operation_runs_kind_check;
alter table public.operation_runs
  add constraint operation_runs_kind_check check (kind in (
    'sync_matches', 'sync_news', 'prediction_reminders', 'quiz_reminders',
    'results_digest', 'recap_digest', 'comeback_emails', 'playoff_score_email'
  ));
