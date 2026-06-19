-- ===========================================================================
-- Results-digest dedupe ledger
-- ---------------------------------------------------------------------------
-- Records that the once-daily results digest was sent to a player for a given
-- UTC calendar day. The results-digest cron emails every active opted-in player
-- a summary of the day (leaderboard top 5, their own rank + day-over-day delta,
-- and the day's biggest movers). A (digest_date, user_id) pair is "pending" when
-- the player is active, opted-in, and has no ledger row for the day; the row is
-- written only after Resend accepts the batch, so the ledger gives at-most-once
-- delivery per (day, player) and survives idempotent re-runs and crashes.
--
-- Purely additive. Written/read exclusively by the service-role admin client —
-- RLS is enabled with no policies, so no anon/authenticated access. Same
-- "definer/service-role only" posture as public.result_email_log.
-- ===========================================================================

create table public.results_digest_log (
  digest_date date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (digest_date, user_id)
);
create index results_digest_log_user_id_idx on public.results_digest_log (user_id);

alter table public.results_digest_log enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same posture as public.result_email_log.

-- ---------------------------------------------------------------------------
-- Backfill: pre-mark the current UTC date as "sent" for every player so
-- shipping this feature does not blast a digest for a day already in progress.
-- After this, the first cron run only sends for the NEXT day onward.
-- ---------------------------------------------------------------------------
insert into public.results_digest_log (digest_date, user_id)
select (now() at time zone 'utc')::date, p.id
from public.profiles p
on conflict (digest_date, user_id) do nothing;
