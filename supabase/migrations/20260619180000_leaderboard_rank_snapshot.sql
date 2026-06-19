-- ===========================================================================
-- Leaderboard rank snapshot
-- ---------------------------------------------------------------------------
-- Captures each ranked player's overall-leaderboard rank as of the most recent
-- sync-matches run, BEFORE that run recomputes scores. The result email already
-- shows a player's *new* rank (read from v_leaderboard_overall after scores are
-- recomputed); to also show movement ("you moved up 3 to #7") the dispatch needs
-- the *previous* rank, which the recompute would otherwise overwrite. The cron
-- upserts this table from v_leaderboard_overall before runSync(), so each row
-- holds "the rank as of the previous run" — the correct baseline for "since the
-- last results came in". Across a run where several matches finalize together,
-- the delta is the net move over that batch, which is the intended semantics.
--
-- Purely additive: does not touch matches, scores, predictions, or
-- compute_match_scores, and is NOT backfilled — the first run after deploy sees
-- an empty table and renders the "new" (no-movement) variant rather than a false
-- "+0". Written/read exclusively by the service-role admin client — RLS is
-- enabled with no policies, so no anon/authenticated access. Same
-- "definer/service-role only" posture as public.result_email_log and
-- public.scores.
-- ===========================================================================

create table public.leaderboard_rank_snapshot (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank int not null,
  captured_at timestamptz not null default now(),
  primary key (competition_id, user_id)
);

alter table public.leaderboard_rank_snapshot enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this snapshot. Same "definer/service-role only" posture as
-- public.result_email_log.
