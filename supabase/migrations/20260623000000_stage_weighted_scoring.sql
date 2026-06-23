-- ---------------------------------------------------------------------------
-- Stage-weighted scoring
-- ---------------------------------------------------------------------------
-- Redefine public.compute_match_scores so the base accuracy points (5/3/1/0)
-- are multiplied by a per-stage factor (strong escalation):
--   group ×1, r32 ×2, r16 ×4, qf ×6, sf ×8, final ×10, third ×4.
-- An unknown/unmapped stage falls back to ×1 (no zeroing of future stages).
-- The hit_type classification is unchanged. This is a going-forward redefinition
-- only: there is NO recompute loop over already-scored matches.

create or replace function public.compute_match_scores(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  v_mult int;
begin
  -- Always clear existing scores for this match first.
  delete from public.scores where match_id = p_match_id;

  select id, home_score, away_score, status, stage
    into m
  from public.matches
  where id = p_match_id;

  -- If the match doesn't exist, isn't final, or has no scores, leave scores empty.
  if m is null then
    return;
  end if;
  if m.status <> 'final' or m.home_score is null or m.away_score is null then
    return;
  end if;

  -- Per-stage multiplier (mirrors STAGE_POINT_MULTIPLIER in lib/scoring.ts).
  v_mult := case m.stage
    when 'group' then 1
    when 'r32'   then 2
    when 'r16'   then 4
    when 'qf'    then 6
    when 'sf'    then 8
    when 'final' then 10
    when 'third' then 4
    else 1
  end;

  insert into public.scores (user_id, match_id, points, hit_type, computed_at)
  select
    p.user_id,
    p.match_id,
    (case
      when p.home_goals = m.home_score and p.away_goals = m.away_score then 5
      when sign(p.home_goals - p.away_goals) = sign(m.home_score - m.away_score)
           and (p.home_goals - p.away_goals) = (m.home_score - m.away_score) then 3
      when sign(p.home_goals - p.away_goals) = sign(m.home_score - m.away_score) then 1
      else 0
    end) * v_mult as points,
    case
      when p.home_goals = m.home_score and p.away_goals = m.away_score then 'exact'
      when sign(p.home_goals - p.away_goals) = sign(m.home_score - m.away_score)
           and (p.home_goals - p.away_goals) = (m.home_score - m.away_score) then 'winner_gd'
      when sign(p.home_goals - p.away_goals) = sign(m.home_score - m.away_score) then 'winner'
      else 'miss'
    end as hit_type,
    now()
  from public.predictions p
  where p.match_id = p_match_id;
end;
$$;

grant execute on function public.compute_match_scores(uuid) to authenticated;
