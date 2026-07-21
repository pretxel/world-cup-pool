-- ===========================================================================
-- La Liga 2026-2027 competition seed.
-- Single-league-stage format (20 teams, 38 matchdays), no knockout rounds.
-- ===========================================================================

do $$
begin
  perform set_config('app.allow_active_change', '1', true);

  insert into public.competitions (
    slug, kind, name, short_name, season,
    tournament_start_at, tournament_end_at,
    opening_home, opening_away, opening_venue,
    is_active, format_config, providers, branding
  ) values (
    'la-liga-2026-2027',
    'custom',
    'La Liga 2026-2027',
    'La Liga 2026-27',
    '2026-2027',
    '2026-08-15T00:00:00Z',
    '2027-05-23T00:00:00Z',
    null, null, null,
    false,
    jsonb_build_object(
      'stages', jsonb_build_array(
        jsonb_build_object('key','regular','kind','league','order',1,'icon','league','hasGroupCode',false,
          'pointMultiplier', 1, 'tiebreaker', 'h2h',
          'labels', jsonb_build_object('en','Regular season','es','Temporada regular','fr','Saison régulière'))
      ),
      'groups', jsonb_build_object('enabled', false)
    ),
    jsonb_build_object(
      'footballData', jsonb_build_object('code','PD','season','2026'),
      'espn', jsonb_build_object('leaguePath','esp.1')
    ),
    jsonb_build_object(
      'brandCode', 'LALIGA',
      'joinCodePrefix', 'LL',
      'newsQuery', '"La Liga" OR "LaLiga EA Sports" OR "Primera División"',
      'emailFromName', 'La Liga Pools',
      'hosts', jsonb_build_array('Spain')
    )
  )
  on conflict (slug) do nothing;

  perform set_config('app.allow_active_change', '0', true);
end;
$$;
