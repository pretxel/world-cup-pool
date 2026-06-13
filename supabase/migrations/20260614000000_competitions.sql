-- ===========================================================================
-- Competition-agnostic refactor — M1 + M2: the competitions spine
-- ---------------------------------------------------------------------------
-- Introduces public.competitions, the single source of truth for which
-- tournament the app is running. Exactly one competition is "active" site-wide
-- (partial unique index), switched only through set_active_competition(). This
-- migration is additive: it creates the table, its guards, the resolver
-- helpers, and seeds the existing World Cup 2026 as the active competition so
-- the later matches/leaderboard/groups migrations can backfill against it.
--
-- Rollback: drop the functions, triggers, table (in reverse order):
--   drop function if exists public.set_active_competition(uuid);
--   drop function if exists public.active_competition_id();
--   drop table if exists public.competitions cascade;
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  kind text not null default 'custom',
  name text not null,
  short_name text not null,
  season text,
  tournament_start_at timestamptz not null,
  tournament_end_at timestamptz,
  opening_home text,
  opening_away text,
  opening_venue text,
  is_active boolean not null default false,
  format_config jsonb not null,
  providers jsonb not null default '{}'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitions_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint competitions_short_name_length
    check (char_length(short_name) between 1 and 60)
);

create unique index competitions_slug_key on public.competitions (slug);

-- At most one active competition site-wide (single-active invariant).
create unique index competitions_one_active
  on public.competitions (is_active)
  where is_active;

create trigger trg_competitions_updated_at
  before update on public.competitions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- format_config shape validation
-- ---------------------------------------------------------------------------
-- Rejects malformed format_config at write time so the matches validation
-- trigger (next migration) can trust its structure. Mirrored in the app by
-- lib/competition-schema.ts; the DB stays the final authority.
-- ---------------------------------------------------------------------------

create or replace function public.validate_format_config(p_config jsonb)
returns void
language plpgsql
immutable
as $$
declare
  v_stages jsonb := p_config -> 'stages';
  v_groups jsonb := p_config -> 'groups';
  v_stage jsonb;
  v_keys text[] := array[]::text[];
  v_key text;
  v_kind text;
  v_has_group_code boolean;
  v_groups_enabled boolean;
  v_pattern text;
  v_any_group_code boolean := false;
begin
  if v_stages is null or jsonb_typeof(v_stages) <> 'array'
     or jsonb_array_length(v_stages) = 0 then
    raise exception 'format_config.stages must be a non-empty array';
  end if;

  for v_stage in select * from jsonb_array_elements(v_stages) loop
    v_key := v_stage ->> 'key';
    v_kind := v_stage ->> 'kind';
    v_has_group_code := coalesce((v_stage ->> 'hasGroupCode')::boolean, false);

    if v_key is null or char_length(v_key) = 0 then
      raise exception 'format_config stage is missing a key';
    end if;
    if v_key = any (v_keys) then
      raise exception 'format_config has duplicate stage key: %', v_key;
    end if;
    v_keys := array_append(v_keys, v_key);

    if v_kind is null or v_kind not in ('group', 'knockout', 'league') then
      raise exception 'format_config stage % has invalid kind: %', v_key, v_kind;
    end if;

    if v_has_group_code then
      v_any_group_code := true;
    end if;
  end loop;

  if v_groups is null or jsonb_typeof(v_groups) <> 'object' then
    raise exception 'format_config.groups must be an object';
  end if;
  v_groups_enabled := coalesce((v_groups ->> 'enabled')::boolean, false);

  if v_any_group_code and not v_groups_enabled then
    raise exception 'format_config: a stage has hasGroupCode but groups.enabled is false';
  end if;

  if v_groups_enabled then
    v_pattern := v_groups ->> 'pattern';
    if v_pattern is null or char_length(v_pattern) = 0 then
      raise exception 'format_config.groups.pattern is required when groups are enabled';
    end if;
    -- Reject an invalid regex by attempting a match in a guarded block.
    begin
      perform 'A' ~ v_pattern;
    exception when others then
      raise exception 'format_config.groups.pattern is not a valid regex: %', v_pattern;
    end;
  end if;
end;
$$;

create or replace function public.trg_validate_competition()
returns trigger
language plpgsql
as $$
begin
  perform public.validate_format_config(new.format_config);
  return new;
end;
$$;

create trigger trg_competitions_validate
  before insert or update on public.competitions
  for each row execute function public.trg_validate_competition();

-- ---------------------------------------------------------------------------
-- Active-flag guard: is_active may only change through set_active_competition()
-- which sets a transaction-local GUC. Mirrors the guard_profiles_is_admin
-- pattern and removes the "zero active" / "two active via the edit form"
-- failure modes. New rows are always born inactive.
-- ---------------------------------------------------------------------------

create or replace function public.guard_competitions_is_active()
returns trigger
language plpgsql
as $$
declare
  v_allowed boolean := coalesce(
    current_setting('app.allow_active_change', true) = '1', false
  );
begin
  if tg_op = 'INSERT' then
    if new.is_active and not v_allowed then
      new.is_active := false;
    end if;
    return new;
  end if;

  if new.is_active is distinct from old.is_active and not v_allowed then
    raise exception 'is_active can only be changed via set_active_competition()';
  end if;
  return new;
end;
$$;

create trigger trg_competitions_guard_is_active
  before insert or update on public.competitions
  for each row execute function public.guard_competitions_is_active();

-- ---------------------------------------------------------------------------
-- Resolver + switch
-- ---------------------------------------------------------------------------

-- The single anchor every view / RLS policy / domain helper resolves through.
create or replace function public.active_competition_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.competitions where is_active limit 1;
$$;

-- The ONLY mutation path for is_active. Admin-guarded, raises on unknown id,
-- flips the flag in a single statement (the partial unique index is satisfied
-- mid-statement), so zero-active and two-active are both impossible.
create or replace function public.set_active_competition(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if not exists (select 1 from public.competitions where id = p_id) then
    raise exception 'competition % does not exist', p_id;
  end if;
  perform set_config('app.allow_active_change', '1', true);
  update public.competitions set is_active = (id = p_id);
  perform set_config('app.allow_active_change', '0', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.competitions enable row level security;

-- Competition metadata (name, format, branding) is public — the site renders
-- the active competition for anonymous visitors.
create policy "competitions_select_public"
  on public.competitions for select
  to anon, authenticated
  using (true);

-- Admins manage competitions through the app; is_active is still fenced by the
-- guard trigger above, so this policy cannot be used to flip the active flag.
create policy "competitions_admin_write"
  on public.competitions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select on public.competitions to anon, authenticated;
grant execute on function public.active_competition_id() to anon, authenticated;
grant execute on function public.set_active_competition(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- M2: seed World Cup 2026 as the active competition.
-- format_config encodes the exact legacy stage enum + A–L groups, so existing
-- matches validate unchanged once the matches trigger lands.
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('app.allow_active_change', '1', true);

  insert into public.competitions (
    slug, kind, name, short_name, season,
    tournament_start_at, opening_home, opening_away, opening_venue,
    is_active, format_config, providers, branding
  ) values (
    'world-cup-2026',
    'world_cup',
    'FIFA World Cup 2026',
    'World Cup 2026',
    '2026',
    '2026-06-11T19:00:00Z',
    'Mexico',
    'South Africa',
    'Estadio Azteca',
    true,
    jsonb_build_object(
      'stages', jsonb_build_array(
        jsonb_build_object('key','group','kind','group','order',1,'icon','group','hasGroupCode',true,
          'labels', jsonb_build_object('en','Group stage','es','Fase de grupos','fr','Phase de groupes')),
        jsonb_build_object('key','r32','kind','knockout','order',2,'icon','r32','hasGroupCode',false,
          'labels', jsonb_build_object('en','Round of 32','es','Dieciseisavos','fr','Seizièmes')),
        jsonb_build_object('key','r16','kind','knockout','order',3,'icon','r16','hasGroupCode',false,
          'labels', jsonb_build_object('en','Round of 16','es','Octavos de final','fr','Huitièmes')),
        jsonb_build_object('key','qf','kind','knockout','order',4,'icon','qf','hasGroupCode',false,
          'labels', jsonb_build_object('en','Quarter-final','es','Cuartos de final','fr','Quarts de finale')),
        jsonb_build_object('key','sf','kind','knockout','order',5,'icon','sf','hasGroupCode',false,
          'labels', jsonb_build_object('en','Semi-final','es','Semifinal','fr','Demi-finale')),
        jsonb_build_object('key','third','kind','knockout','order',6,'icon','third','hasGroupCode',false,
          'labels', jsonb_build_object('en','Third-place play-off','es','Tercer puesto','fr','Match pour la 3e place')),
        jsonb_build_object('key','final','kind','knockout','order',7,'icon','final','hasGroupCode',false,
          'labels', jsonb_build_object('en','Final','es','Final','fr','Finale'))
      ),
      'groups', jsonb_build_object('enabled', true, 'pattern', '^[A-L]$', 'count', 12)
    ),
    jsonb_build_object(
      'footballData', jsonb_build_object('code','WC','season','2026'),
      'espn', jsonb_build_object('leaguePath','fifa.world')
    ),
    jsonb_build_object(
      'brandCode', 'WC26',
      'joinCodePrefix', 'WC',
      'newsQuery', '"World Cup 2026" OR "FIFA World Cup 2026"',
      'emailFromName', 'World Cup Pools',
      'hosts', jsonb_build_array('Canada','Mexico','USA')
    )
  )
  on conflict (slug) do nothing;

  perform set_config('app.allow_active_change', '0', true);
end;
$$;
