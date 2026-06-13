-- ===========================================================================
-- Competition-agnostic refactor — M6: scope friend groups to a competition
-- ---------------------------------------------------------------------------
-- Friend boards belong to a competition. Adds groups.competition_id (backfilled
-- to World Cup 2026), parameterizes the join-code prefix off the competition's
-- branding, stamps new groups with the active competition, and scopes the mini
-- board to the group's own competition. Existing WC- join codes stay valid.
--
-- Rollback: drop groups.competition_id; restore generate_join_code()/
-- create_group()/leaderboard_for_group() from 20260607000000_friends_groups.sql.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- competition_id column + backfill
-- ---------------------------------------------------------------------------

alter table public.groups
  add column competition_id uuid references public.competitions(id) on delete restrict;

update public.groups
  set competition_id = (select id from public.competitions where slug = 'world-cup-2026')
  where competition_id is null;

alter table public.groups
  alter column competition_id set not null;

create index groups_competition_id_idx on public.groups (competition_id);

-- ---------------------------------------------------------------------------
-- Join-code generation now takes a per-competition prefix (default 'WC').
-- Drop the original no-arg version first: adding a defaulted parameter creates
-- a NEW overload rather than replacing it, leaving an orphaned function.
-- ---------------------------------------------------------------------------

drop function if exists public.generate_join_code();

create or replace function public.generate_join_code(p_prefix text default 'WC')
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text := '';
  i int;
  v_prefix text := upper(coalesce(nullif(btrim(p_prefix), ''), 'WC'));
begin
  for i in 1..5 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return v_prefix || '-' || code;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_group: stamp the active competition + use its join-code prefix.
-- ---------------------------------------------------------------------------

create or replace function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_code text;
  v_attempts int := 0;
  v_name text := btrim(coalesce(p_name, ''));
  v_competition_id uuid := public.active_competition_id();
  v_prefix text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    raise exception 'group name must be between 2 and 40 characters';
  end if;
  if v_competition_id is null then
    raise exception 'no active competition';
  end if;

  select coalesce(branding ->> 'joinCodePrefix', 'WC') into v_prefix
  from public.competitions where id = v_competition_id;

  loop
    v_attempts := v_attempts + 1;
    v_code := public.generate_join_code(v_prefix);
    begin
      insert into public.groups (name, owner_id, join_code, competition_id)
      values (v_name, v_uid, v_code, v_competition_id)
      returning id into v_group_id;
      exit;
    exception when unique_violation then
      if v_attempts >= 10 then
        raise exception 'could not generate a unique join code';
      end if;
    end;
  end loop;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'owner');

  return v_group_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- leaderboard_for_group: scope scores to the group's own competition.
-- ---------------------------------------------------------------------------

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

grant execute on function public.generate_join_code(text) to authenticated;
grant execute on function public.leaderboard_for_group(uuid) to authenticated;
