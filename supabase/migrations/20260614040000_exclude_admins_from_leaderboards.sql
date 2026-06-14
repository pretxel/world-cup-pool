-- ===========================================================================
-- Exclude admin accounts from all leaderboards
-- ---------------------------------------------------------------------------
-- The admin is an operator, not a contestant. These three ranking surfaces
-- previously included every profile; each now filters `is_admin = false`
-- INSIDE its aggregate CTE — before rank() is computed — so admins disappear
-- AND the remaining ranks stay contiguous (no gap where an admin used to sit).
--
-- Filtering at the final profiles join instead would drop the admin row after
-- ranking and leave a hole (1, 3, 4, ...), which is why the filter lives in agg.
--
-- Output row shapes, grants, and the function signature are unchanged, so all
-- callers are untouched. public.v_quiz_standing is built on v_quiz_leaderboard,
-- so it inherits the exclusion with no change here.
--
-- Rollback: re-create these objects from their prior migrations
-- (20260614000200_leaderboard_competition_scope.sql for the overall view and
-- the per-day function; 20260606000000_daily_quiz.sql for v_quiz_leaderboard)
-- without the is_admin filter.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Overall predictions leaderboard.
-- ---------------------------------------------------------------------------
create or replace view public.v_leaderboard_overall as
with agg as (
  select
    s.user_id,
    sum(s.points)::int as total_points,
    count(*) filter (where s.hit_type = 'exact')::int as exact_hits,
    count(*) filter (where s.hit_type = 'winner_gd')::int as winner_gd_hits,
    count(*) filter (where s.hit_type = 'winner')::int as winner_hits,
    min(p.submitted_at) as first_submit
  from public.scores s
  join public.matches m
    on m.id = s.match_id and m.competition_id = public.active_competition_id()
  join public.predictions p
    on p.user_id = s.user_id and p.match_id = s.match_id
  join public.profiles pr_f
    on pr_f.id = s.user_id and pr_f.is_admin = false
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

grant select on public.v_leaderboard_overall to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Per-day predictions leaderboard.
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_for_day(d date, tz text default 'UTC')
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
  with day_bounds as (
    select
      (d::timestamp at time zone tz) as day_start_utc,
      ((d + 1)::timestamp at time zone tz) as day_end_utc
  ),
  agg as (
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
      and m.kickoff_at >= (select day_start_utc from day_bounds)
      and m.kickoff_at <  (select day_end_utc   from day_bounds)
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

grant execute on function public.leaderboard_for_day(date, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Quiz leaderboard. v_quiz_standing reads from this view, so it inherits the
-- exclusion automatically.
-- ---------------------------------------------------------------------------
create or replace view public.v_quiz_leaderboard as
with agg as (
  select
    a.user_id,
    (count(*) filter (where a.is_correct) * 10)::int as total_points,
    count(*)::int as total_answered,
    min(a.answered_at) as first_answer
  from public.quiz_answers a
  join public.profiles pr_f
    on pr_f.id = a.user_id and pr_f.is_admin = false
  group by a.user_id
)
select
  ag.user_id,
  pr.display_name,
  ag.total_points,
  ag.total_answered,
  ag.first_answer,
  rank() over (order by ag.total_points desc, ag.first_answer asc) as rank
from agg ag
join public.profiles pr on pr.id = ag.user_id;

grant select on public.v_quiz_leaderboard to anon, authenticated;
