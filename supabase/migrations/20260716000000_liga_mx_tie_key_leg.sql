-- ===========================================================================
-- Liga MX support: tie_key / leg for two-legged knockout ties + per-stage
-- point multiplier resolution from format_config + Liga MX competition seed.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- [1] Add tie_key and leg to matches for aggregate ties (e.g. liguilla).
-- Both are nullable so existing World Cup matches are unaffected.
-- ---------------------------------------------------------------------------

alter table public.matches
  add column tie_key text,
  add column leg int;

create index matches_tie_key_idx on public.matches (competition_id, tie_key);

-- ---------------------------------------------------------------------------
-- [2] Redefine compute_match_scores to resolve the per-stage multiplier from
-- the competition's format_config.stages[].pointMultiplier when present,
-- falling back to the hardcoded map.
-- ---------------------------------------------------------------------------

create or replace function public.compute_match_scores(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  v_mult int;
  v_comp_id uuid;
  v_stage_key text;
  v_stage jsonb;
begin
  -- Always clear existing scores for this match first.
  delete from public.scores where match_id = p_match_id;

  select id, home_score, away_score, status, stage, competition_id
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

  v_comp_id := m.competition_id;
  v_stage_key := m.stage;

  -- Resolve per-stage multiplier: prefer pointMultiplier from format_config,
  -- fall back to hardcoded map.
  select s into v_stage
  from public.competitions c
  cross join lateral jsonb_array_elements(c.format_config -> 'stages') s
  where c.id = v_comp_id
    and s ->> 'key' = v_stage_key
  limit 1;

  if v_stage is not null and (v_stage ->> 'pointMultiplier') is not null then
    v_mult := (v_stage ->> 'pointMultiplier')::int;
  else
    v_mult := case v_stage_key
      when 'group' then 1
      when 'r32'   then 2
      when 'r16'   then 4
      when 'qf'    then 6
      when 'sf'    then 8
      when 'final' then 10
      when 'third' then 4
      else 1
    end;
  end if;

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

-- ---------------------------------------------------------------------------
-- [3] Seed Liga MX Apertura 2026 competition.
-- Format: 18-team league stage + liguilla (QF, SF, Final) with per-stage
-- multipliers. Liga MX uses a 6-team liguilla format where the top 6 qualify:
-- seeds 1-2 get a bye to SF, seeds 3-6 play QF (3v6, 4v5).
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('app.allow_active_change', '1', true);

  insert into public.competitions (
    slug, kind, name, short_name, season,
    tournament_start_at, tournament_end_at,
    opening_home, opening_away, opening_venue,
    is_active, format_config, providers, branding
  ) values (
    'liga-mx-apertura-2026',
    'custom',
    'Liga MX Apertura 2026',
    'Liga MX 2026',
    '2026',
    '2026-07-03T00:00:00Z',
    '2026-12-13T00:00:00Z',
    null, null, null,
    false,
    jsonb_build_object(
      'stages', jsonb_build_array(
        jsonb_build_object('key','league','kind','league','order',1,'icon','league','hasGroupCode',false,
          'pointMultiplier', 1,
          'labels', jsonb_build_object('en','League stage','es','Fase regular','fr','Phase de championnat')),
        jsonb_build_object('key','qf','kind','knockout','order',2,'icon','qf','hasGroupCode',false,
          'revealed', true, 'pointMultiplier', 2,
          'labels', jsonb_build_object('en','Quarter-final','es','Cuartos de final','fr','Quarts de finale')),
        jsonb_build_object('key','sf','kind','knockout','order',3,'icon','sf','hasGroupCode',false,
          'revealed', true, 'pointMultiplier', 3,
          'labels', jsonb_build_object('en','Semi-final','es','Semifinal','fr','Demi-finale')),
        jsonb_build_object('key','final','kind','knockout','order',4,'icon','final','hasGroupCode',false,
          'revealed', true, 'pointMultiplier', 4,
          'labels', jsonb_build_object('en','Final','es','Final','fr','Finale'))
      ),
      'groups', jsonb_build_object('enabled', false)
    ),
    jsonb_build_object(
      'footballData', jsonb_build_object('code','LMX','season','2026'),
      'espn', jsonb_build_object('leaguePath','mex.liga')
    ),
    jsonb_build_object(
      'brandCode', 'LMX',
      'joinCodePrefix', 'MX',
      'newsQuery', '"Liga MX" OR "Liga MX Apertura 2026"',
      'emailFromName', 'Liga MX Pools',
      'hosts', jsonb_build_array('Mexico')
    )
  )
  on conflict (slug) do nothing;

  perform set_config('app.allow_active_change', '0', true);
end;
$$;
