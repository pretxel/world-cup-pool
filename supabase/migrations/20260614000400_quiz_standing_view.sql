-- ===========================================================================
-- Quiz social sharing — public standing view
-- ===========================================================================
-- The quiz share landing page and OG card are fetched by anonymous social
-- scrapers and other users, so the standing they show must be publicly
-- readable. quiz_answers is RLS-restricted to the owner (quiz_answers_select_own),
-- so a streak cannot be derived per-user by an anon client. This view runs with
-- owner rights (security_invoker = off, like v_quiz_leaderboard) to compute the
-- streak from quiz_answers and expose ONLY the aggregate standing — never the
-- raw answers. It reuses v_quiz_leaderboard for rank/points/answered/name so the
-- shared rank matches the on-site quiz leaderboard exactly.
-- ===========================================================================

create or replace view public.v_quiz_standing
  with (security_invoker = off) as
-- Distinct UTC days each user answered on.
with days as (
  select distinct
    a.user_id,
    ((a.answered_at at time zone 'utc')::date) as d
  from public.quiz_answers a
),
-- Gaps-and-islands: consecutive days share a constant (d - row_number()).
grp as (
  select
    user_id,
    d,
    (d - (row_number() over (partition by user_id order by d))::int) as g
  from days
),
islands as (
  select user_id, max(d) as last_day, count(*)::int as len
  from grp
  group by user_id, g
),
-- The current streak is the island that reaches today or yesterday (UTC) —
-- today-not-yet-answered keeps the streak alive. Matches lib/quiz.computeStreak.
streaks as (
  select user_id, len as streak
  from islands
  where last_day >= (((now() at time zone 'utc')::date) - 1)
)
select
  ql.user_id,
  ql.display_name,
  ql.total_points,
  ql.total_answered,
  ql.rank,
  coalesce(s.streak, 0)::int as streak
from public.v_quiz_leaderboard ql
left join streaks s on s.user_id = ql.user_id;

grant select on public.v_quiz_standing to anon, authenticated;
