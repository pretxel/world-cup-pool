-- ===========================================================================
-- Result-email dedupe ledger
-- ---------------------------------------------------------------------------
-- Records that a result-standing email was sent to a player for a finalized
-- match. The sync-matches cron, after recomputing scores, emails each player
-- whose standing changed (had a `scores` row on a newly-final match). A pair
-- is "pending" when its match is final, a score row exists, and no ledger row
-- exists yet; the row is written only after Resend accepts the message, so the
-- ledger gives at-most-once delivery per (match, player) and survives
-- idempotent re-runs and crashes.
--
-- Purely additive: does not touch matches, scores, predictions, or
-- compute_match_scores. Written/read exclusively by the service-role admin
-- client — RLS is enabled with no policies, so no anon/authenticated access.
-- ===========================================================================

create table public.result_email_log (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index result_email_log_user_id_idx on public.result_email_log (user_id);

alter table public.result_email_log enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same "definer/service-role only" posture as public.scores.

-- ---------------------------------------------------------------------------
-- Backfill: pre-mark every already-final match's scored players as "sent" so
-- shipping this feature does not blast historical results. After this, the
-- pending-recipient query returns rows only for matches that finalize AFTER
-- deploy.
-- ---------------------------------------------------------------------------
insert into public.result_email_log (match_id, user_id)
select distinct s.match_id, s.user_id
from public.scores s
join public.matches m on m.id = s.match_id
where m.status = 'final'
on conflict (match_id, user_id) do nothing;
