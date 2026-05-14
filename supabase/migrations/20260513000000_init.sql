-- ===========================================================================
-- World Cup 2026 Pool — initial schema
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 2 and 32)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in ('group','r32','r16','qf','sf','third','final')),
  group_code text check (group_code is null or group_code ~ '^[A-L]$'),
  home_team text not null check (char_length(home_team) > 0),
  away_team text not null check (char_length(away_team) > 0 and away_team <> home_team),
  kickoff_at timestamptz not null,
  venue text,
  home_score smallint check (home_score is null or home_score between 0 and 30),
  away_score smallint check (away_score is null or away_score between 0 and 30),
  status text not null default 'scheduled'
    check (status in ('scheduled','live','final','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index matches_kickoff_at_idx on public.matches (kickoff_at);
create index matches_status_idx on public.matches (status);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_goals smallint not null check (home_goals between 0 and 20),
  away_goals smallint not null check (away_goals between 0 and 20),
  submitted_at timestamptz not null default now(),
  unique (user_id, match_id)
);
create index predictions_match_id_idx on public.predictions (match_id);
create index predictions_user_id_idx on public.predictions (user_id);

create table public.scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  points smallint not null check (points >= 0),
  hit_type text not null check (hit_type in ('exact','winner_gd','winner','miss')),
  computed_at timestamptz not null default now(),
  primary key (user_id, match_id)
);
create index scores_match_id_idx on public.scores (match_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_matches_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auth.users -> profiles trigger: create a profile row on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Scoring function + trigger
-- ---------------------------------------------------------------------------

create or replace function public.compute_match_scores(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  -- Always clear existing scores for this match first.
  delete from public.scores where match_id = p_match_id;

  select id, home_score, away_score, status
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

  insert into public.scores (user_id, match_id, points, hit_type, computed_at)
  select
    p.user_id,
    p.match_id,
    case
      when p.home_goals = m.home_score and p.away_goals = m.away_score then 5
      when sign(p.home_goals - p.away_goals) = sign(m.home_score - m.away_score)
           and (p.home_goals - p.away_goals) = (m.home_score - m.away_score) then 3
      when sign(p.home_goals - p.away_goals) = sign(m.home_score - m.away_score) then 1
      else 0
    end as points,
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

create or replace function public.trg_recompute_scores()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'UPDATE' and (
        new.home_score is distinct from old.home_score
     or new.away_score is distinct from old.away_score
     or new.status     is distinct from old.status
  )) or tg_op = 'INSERT' then
    perform public.compute_match_scores(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_recompute_scores_on_match_change
  after insert or update on public.matches
  for each row execute function public.trg_recompute_scores();

-- ---------------------------------------------------------------------------
-- Leaderboard view + function
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
    where m.kickoff_at >= (select day_start_utc from day_bounds)
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

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.matches     enable row level security;
alter table public.predictions enable row level security;
alter table public.scores      enable row level security;

-- helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---- profiles ----
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Prevent self-promotion: only the service role (which sets a service_role JWT
-- or hits the DB without a JWT) can flip `is_admin`.
create or replace function public.guard_profiles_is_admin()
returns trigger
language plpgsql
as $$
declare
  jwt_role text;
begin
  if new.is_admin is distinct from old.is_admin then
    jwt_role := (current_setting('request.jwt.claims', true)::jsonb ->> 'role');
    if jwt_role is null or jwt_role = 'service_role' then
      return new;
    end if;
    raise exception 'is_admin cannot be changed via the user API';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard_is_admin
  before update on public.profiles
  for each row execute function public.guard_profiles_is_admin();

-- ---- matches ----
create policy "matches_select_public"
  on public.matches for select
  to anon, authenticated
  using (true);

create policy "matches_admin_write"
  on public.matches for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- predictions ----
create policy "predictions_select_own"
  on public.predictions for select
  to authenticated
  using (user_id = auth.uid());

create policy "predictions_select_after_final"
  on public.predictions for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = predictions.match_id and m.status = 'final'
    )
  );

create policy "predictions_insert_own_before_kickoff"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id and m.kickoff_at > now()
    )
  );

create policy "predictions_update_own_before_kickoff"
  on public.predictions for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id and m.kickoff_at > now()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id and m.kickoff_at > now()
    )
  );

create policy "predictions_admin_select_all"
  on public.predictions for select
  to authenticated
  using (public.is_admin());

-- ---- scores ----
create policy "scores_select_authenticated"
  on public.scores for select
  to authenticated
  using (true);

-- No insert/update/delete policies for scores → only the security-definer
-- function compute_match_scores() can write to it.

-- ---------------------------------------------------------------------------
-- Grants for the leaderboard view + function
-- ---------------------------------------------------------------------------

grant select on public.v_leaderboard_overall to anon, authenticated;
grant execute on function public.leaderboard_for_day(date, text) to anon, authenticated;
grant execute on function public.compute_match_scores(uuid) to authenticated;
