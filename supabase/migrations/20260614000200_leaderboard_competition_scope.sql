-- ===========================================================================
-- Competition-agnostic refactor — M5: scope leaderboards + predictions RLS
-- ---------------------------------------------------------------------------
-- The overall view and the per-day function now restrict to the active
-- competition via a matches join; predictions RLS additionally requires the
-- target match to belong to the active competition. Output row shapes and the
-- function signature are unchanged, so callers are untouched. With World Cup
-- 2026 the only competition, every result is identical to before (M5 parity).
--
-- Rollback: re-create the view/function/policies from the previous migrations
-- (20260513000000_init.sql) without the competition_id filter.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Overall leaderboard: add the matches join filtered to the active competition.
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
-- Per-day leaderboard: add the active-competition filter to the matches join.
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
-- Predictions RLS: add the active-competition clause on top of the existing
-- status='scheduled' + kickoff gates (from 20260514000000_lock_predictions_on_final).
-- Own-pick reads stay unrestricted; cross-user reads after final and all writes
-- are limited to the active competition.
-- ---------------------------------------------------------------------------

drop policy if exists "predictions_select_after_final" on public.predictions;
create policy "predictions_select_after_final"
  on public.predictions for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.status = 'final'
        and m.competition_id = public.active_competition_id()
    )
  );

drop policy if exists "predictions_insert_own_before_kickoff" on public.predictions;
create policy "predictions_insert_own_before_kickoff"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.status = 'scheduled'
        and m.kickoff_at > now()
        and m.competition_id = public.active_competition_id()
    )
  );

drop policy if exists "predictions_update_own_before_kickoff" on public.predictions;
create policy "predictions_update_own_before_kickoff"
  on public.predictions for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.status = 'scheduled'
        and m.kickoff_at > now()
        and m.competition_id = public.active_competition_id()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.status = 'scheduled'
        and m.kickoff_at > now()
        and m.competition_id = public.active_competition_id()
    )
  );
