-- ===========================================================================
-- Group join-date scoring — re-level late joiners on the friend mini board
-- ---------------------------------------------------------------------------
-- COMPETITIVE SCORING CHANGE. Re-creates public.leaderboard_for_group(uuid) so
-- each member is aggregated only over matches whose kickoff_at is on or after
-- that member's own group_members.joined_at. The cutoff is PER MEMBER (the
-- group_members join already binds gm to the specific (group, member) row, so
-- the predicate m.kickoff_at >= gm.joined_at is naturally per member): founders
-- are scored from group creation, late joiners from their own join instant.
--
-- The boundary is inclusive (>=): a match whose kickoff equals a member's
-- joined_at counts (a member present at kickoff could still legitimately have a
-- pick). Re-joining (leave then re-join) resets joined_at and therefore moves
-- the cutoff forward; this is accepted (it can only shrink a member's scored
-- window, never inflate a score) and avoids new schema.
--
-- Everything else about this RPC is UNCHANGED: the RETURNS TABLE shape, the
-- is_group_member(p_group_id) membership guard, the competition scope
-- (m.competition_id = g.competition_id), the security definer posture, the
-- predictions join for the first_submit tie-breaker, and the tie-breaker order
-- (total_points desc, exact_hits desc, winner_gd_hits desc, first_submit asc).
--
-- EXPLICITLY UNCHANGED elsewhere: the GLOBAL leaderboard (v_leaderboard_overall)
-- stays whole-tournament and canonical, as do leaderboard_for_day, the
-- segmented leaderboard functions, scores, predictions, and compute_match_scores.
-- A user's all-time global total is unaffected; only the group-scoped ranking
-- changes.
--
-- Rollback: restore the leaderboard_for_group() body from
-- 20260614000300_groups_competition_scope.sql (which has no join-date filter).
-- ===========================================================================

create or replace function public.leaderboard_for_group(p_group_id uuid)
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
security definer
set search_path = public
as $$
  -- Per-member join-date scoring: each member is aggregated only over matches
  -- whose kickoff_at is on or after that member's group_members.joined_at
  -- (boundary inclusive). The GLOBAL board (v_leaderboard_overall) is unchanged.
  with agg as (
    select
      s.user_id,
      sum(s.points)::int as total_points,
      count(*) filter (where s.hit_type = 'exact')::int as exact_hits,
      count(*) filter (where s.hit_type = 'winner_gd')::int as winner_gd_hits,
      count(*) filter (where s.hit_type = 'winner')::int as winner_hits,
      min(p.submitted_at) as first_submit
    from public.scores s
    join public.group_members gm
      on gm.user_id = s.user_id and gm.group_id = p_group_id
    join public.groups g
      on g.id = p_group_id
    join public.matches m
      on m.id = s.match_id and m.competition_id = g.competition_id
     and m.kickoff_at >= gm.joined_at
    join public.predictions p
      on p.user_id = s.user_id and p.match_id = s.match_id
    where public.is_group_member(p_group_id)
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

grant execute on function public.leaderboard_for_group(uuid) to authenticated;
