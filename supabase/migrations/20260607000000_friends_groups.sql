-- ===========================================================================
-- Friends groups + mini boards
-- ---------------------------------------------------------------------------
-- Adds private friend groups. Each group renders a "mini board": the same
-- ranking as the global leaderboard, scoped to the group's members. Scores
-- stay global (one prediction -> one score, counted in every group a user
-- belongs to) — this migration is purely additive and does not touch
-- predictions, scores, compute_match_scores, or the global leaderboard.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  join_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_length check (char_length(name) between 2 and 40)
);
create unique index groups_join_code_key on public.groups (join_code);
create index groups_owner_id_idx on public.groups (owner_id);

create trigger trg_groups_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_id_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer → bypass RLS → no policy recursion)
-- Same pattern as public.is_admin(): a definer function lets RLS policies on
-- group_members reference group_members without recursing.
-- ---------------------------------------------------------------------------

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where id = p_group_id and owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Join-code generation: WC-XXXXX over a 31-char alphabet that excludes the
-- visually ambiguous glyphs 0 O 1 I L.
-- ---------------------------------------------------------------------------

create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text := '';
  i int;
begin
  for i in 1..5 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return 'WC-' || code;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_group: insert the group with a collision-retried unique join_code,
-- then add the caller as the owner member. Returns the new group id.
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
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    raise exception 'group name must be between 2 and 40 characters';
  end if;

  loop
    v_attempts := v_attempts + 1;
    v_code := public.generate_join_code();
    begin
      insert into public.groups (name, owner_id, join_code)
      values (v_name, v_uid, v_code)
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
-- join_group: resolve a group by its code and add the CALLER (only) as a
-- member. The secret code is the gate — group_members has no insert policy,
-- so this definer RPC is the sole join path. Idempotent.
-- ---------------------------------------------------------------------------

create or replace function public.join_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id into v_group_id
  from public.groups
  where join_code = upper(btrim(coalesce(p_code, '')));

  if v_group_id is null then
    raise exception 'invalid join code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- group_preview: name-only lookup by code so a non-member can confirm an
-- invite before joining, without exposing the member-scoped board.
-- ---------------------------------------------------------------------------

create or replace function public.group_preview(p_code text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.name
  from public.groups g
  where g.join_code = upper(btrim(coalesce(p_code, '')));
$$;

-- ---------------------------------------------------------------------------
-- leave_group / remove_group_member: definer RPCs enforcing the lifecycle
-- rules. group_members has no user-facing delete policy, so membership only
-- changes through these (and the group-delete cascade).
-- ---------------------------------------------------------------------------

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if public.is_group_owner(p_group_id) then
    raise exception 'owner cannot leave; delete the group instead';
  end if;
  delete from public.group_members
  where group_id = p_group_id and user_id = v_uid;
end;
$$;

create or replace function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_group_owner(p_group_id) then
    raise exception 'only the owner can remove members';
  end if;
  if p_user_id = v_uid then
    raise exception 'owner cannot remove themselves; delete the group instead';
  end if;
  delete from public.group_members
  where group_id = p_group_id and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- leaderboard_for_group: the mini board. Mirrors v_leaderboard_overall's
-- aggregation + tie-breakers, joined to group_members and ranked within the
-- group. Whole-tournament scoring (no join-date filter). Returns rows only
-- when the caller is a member (the is_group_member() guard short-circuits the
-- CTE to empty for non-members).
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

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

-- ---- groups ----
-- Members read their groups; non-members use group_preview() for the name.
create policy "groups_select_members"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

-- Only the owner can rename. (No insert policy: creation is via create_group.)
create policy "groups_update_owner"
  on public.groups for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Only the owner can delete (cascades memberships).
create policy "groups_delete_owner"
  on public.groups for delete
  to authenticated
  using (owner_id = auth.uid());

-- ---- group_members ----
-- Co-members can read each other (member list + counts).
create policy "group_members_select_comembers"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

-- No insert/update/delete policies: joining is via join_group(), leaving via
-- leave_group(), removal via remove_group_member(), all security definer.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.group_preview(text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.leaderboard_for_group(uuid) to authenticated;
