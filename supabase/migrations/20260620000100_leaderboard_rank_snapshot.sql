-- ===========================================================================
-- Per-day leaderboard rank snapshot
-- ---------------------------------------------------------------------------
-- v_leaderboard_overall is a live view with no history, so day-over-day rank
-- deltas and the "biggest movers" section of the results digest have no
-- baseline. This table is the minimal durable baseline: one row per active
-- player per UTC calendar day capturing that day's rank.
--
-- The results-digest dispatcher upserts today's snapshot from
-- v_leaderboard_overall before computing movers, then compares against the most
-- recent prior snapshot. rank() is a window over the whole board at a point in
-- time and cannot be reconstructed cheaply after the fact, so a stored snapshot
-- is required rather than deriving from scores timestamps.
--
-- Purely additive. Written/read exclusively by the service-role digest
-- dispatcher — RLS is enabled with no policies, so no anon/authenticated access.
-- ===========================================================================

create table public.leaderboard_rank_snapshot (
  snapshot_date date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank int not null,
  primary key (snapshot_date, user_id)
);

alter table public.leaderboard_rank_snapshot enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this snapshot. It is written only by the service-role results-digest
-- dispatcher.
