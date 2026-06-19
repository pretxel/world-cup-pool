-- ===========================================================================
-- Segmented leaderboard: windowed and per-stage ranking functions
-- ---------------------------------------------------------------------------
-- The public /leaderboard previously offered only the all-time board
-- (v_leaderboard_overall). These two functions add the same ranking algebra
-- restricted to a time window (this week) and to a single tournament stage,
-- so a mid-table player gets a short-horizon, reachable competition.
--
-- Both mirror v_leaderboard_overall / leaderboard_for_day exactly:
--   * the is_admin = false filter lives INSIDE the aggregate CTE (`agg`), so
--     admins disappear AND the remaining ranks stay contiguous;
--   * scoped to public.active_competition_id();
--   * identical output columns and tie-breakers
--     (total_points desc, exact_hits desc, winner_gd_hits desc, first_submit asc).
-- Only the WHERE predicate differs (kickoff window vs. stage equality).
--
-- v_leaderboard_overall and leaderboard_for_day are left untouched, so the
-- overall segment and all existing callers are unaffected.
--
-- Rollback:
--   drop function if exists public.leaderboard_for_window(timestamptz, timestamptz);
--   drop function if exists public.leaderboard_for_stage(text);
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Windowed predictions leaderboard. Bounds are passed as explicit UTC instants
-- (computed by the caller, like leaderboard_for_day takes its date), keeping
-- the function pure/testable and clock-free. Half-open window [from_ts, to_ts).
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_for_window(
  from_ts timestamptz,
  to_ts timestamptz
)
returns table (
  user_id uuid,
  display_name text,
  total_points int,
  exact_hits int,
  winner_gd_hits int,
  winner_hits int,
  first_submit timestamptz,
  rank bigint
)
language sql
stable
as $$
  with agg as (
    select
      s.user_id,
      sum(s.points)::int as total_points,
      count(*) filter (where s.hit_type = 'exact')::int as exact_hits,
      count(*) filter (where s.hit_type = 'winner_gd')::int as winner_gd_hits,
      count(*) filter (where s.hit_type = 'winner')::int as winner_hits,
      min(p.submitted_at) as first_submit
    from public.scores s
    join public.matches m on m.id = s.match_id
    join public.predictions p on p.user_id = s.user_id and p.match_id = s.match_id
    join public.profiles pr_f on pr_f.id = s.user_id and pr_f.is_admin = false
    where m.competition_id = public.active_competition_id()
      and m.kickoff_at >= from_ts
      and m.kickoff_at <  to_ts
    group by s.user_id
  )
  select
    a.user_id,
    pr.display_name,
    a.total_points,
    a.exact_hits,
    a.winner_gd_hits,
    a.winner_hits,
    a.first_submit,
    rank() over (
      order by a.total_points desc, a.exact_hits desc, a.winner_gd_hits desc, a.first_submit asc
    ) as rank
  from agg a
  join public.profiles pr on pr.id = a.user_id;
$$;

grant execute on function public.leaderboard_for_window(timestamptz, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Per-stage predictions leaderboard. Same aggregate, filtered to one
-- matches.stage value. An unknown stage simply yields zero rows.
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_for_stage(stage_key text)
returns table (
  user_id uuid,
  display_name text,
  total_points int,
  exact_hits int,
  winner_gd_hits int,
  winner_hits int,
  first_submit timestamptz,
  rank bigint
)
language sql
stable
as $$
  with agg as (
    select
      s.user_id,
      sum(s.points)::int as total_points,
      count(*) filter (where s.hit_type = 'exact')::int as exact_hits,
      count(*) filter (where s.hit_type = 'winner_gd')::int as winner_gd_hits,
      count(*) filter (where s.hit_type = 'winner')::int as winner_hits,
      min(p.submitted_at) as first_submit
    from public.scores s
    join public.matches m on m.id = s.match_id
    join public.predictions p on p.user_id = s.user_id and p.match_id = s.match_id
    join public.profiles pr_f on pr_f.id = s.user_id and pr_f.is_admin = false
    where m.competition_id = public.active_competition_id()
      and m.stage = stage_key
    group by s.user_id
  )
  select
    a.user_id,
    pr.display_name,
    a.total_points,
    a.exact_hits,
    a.winner_gd_hits,
    a.winner_hits,
    a.first_submit,
    rank() over (
      order by a.total_points desc, a.exact_hits desc, a.winner_gd_hits desc, a.first_submit asc
    ) as rank
  from agg a
  join public.profiles pr on pr.id = a.user_id;
$$;

grant execute on function public.leaderboard_for_stage(text) to anon, authenticated;
