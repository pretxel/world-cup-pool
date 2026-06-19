-- ===========================================================================
-- Group referral reward — M4
-- ---------------------------------------------------------------------------
-- Captures who invited a user into a friend group and awards a fixed referral
-- bonus to both the inviter and the invitee on the first invited join.
--
-- SCORING ISOLATION (the load-bearing constraint): the competitive
-- leaderboards (v_leaderboard_overall, leaderboard_for_group) are derived
-- PURELY from public.scores (one prediction -> one score). A referral bonus is
-- therefore recorded in a dedicated public.group_referrals ledger and NEVER as
-- a row in public.scores — this migration does not touch predictions, scores,
-- compute_match_scores, or any leaderboard view/RPC, so the prediction ranking
-- stays byte-for-byte unchanged.
--
-- All capture + award logic lives inside the existing join_group definer RPC
-- (re-created with a new optional p_invited_by param) so there is exactly one
-- transactional join path and RLS stays closed (group_members / group_referrals
-- have no client insert policy). Guards: self-credit, inviter-must-be-member,
-- first-join-only, and once-per-(group, invitee).
--
-- Rollback: drop public.group_referrals; drop group_members.invited_by_user_id;
-- restore join_group(text) from 20260607000000_friends_groups.sql.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Capture column on the membership row. Nullable: manual joins and
-- pre-existing members have no inviter. Set only on the row the RPC creates.
-- ---------------------------------------------------------------------------

alter table public.group_members
  add column invited_by_user_id uuid references public.profiles(id) on delete set null;

create index group_members_invited_by_user_id_idx
  on public.group_members (invited_by_user_id);

-- ---------------------------------------------------------------------------
-- Referral ledger. One row per successful, first-time invited join; names the
-- inviter, the invitee, the group, and the fixed bonus (symmetric: the same
-- points value credits both parties). unique (group_id, invitee_id) makes the
-- award idempotent — a given user can only ever trigger one reward per group.
-- ---------------------------------------------------------------------------

create table public.group_referrals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  points int not null,
  created_at timestamptz not null default now(),
  constraint group_referrals_group_invitee_key unique (group_id, invitee_id)
);
create index group_referrals_inviter_id_idx on public.group_referrals (inviter_id);
create index group_referrals_invitee_id_idx on public.group_referrals (invitee_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security. Co-members may read the ledger; there is no client
-- insert/update/delete policy — rows are written only by the definer RPC.
-- ---------------------------------------------------------------------------

alter table public.group_referrals enable row level security;

create policy "group_referrals_select_comembers"
  on public.group_referrals for select
  to authenticated
  using (public.is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- join_group: resolve a group by its code and add the CALLER (only) as a
-- member, now capturing an optional inviter and awarding a referral bonus on
-- the first invited join. group_members has no insert policy, so this definer
-- RPC is the sole join path. Idempotent.
--
-- Adding a defaulted parameter creates a NEW overload rather than replacing the
-- single-arg version, so drop the old one first (see the generate_join_code()
-- precedent in 20260614000300_groups_competition_scope.sql), then re-grant.
-- ---------------------------------------------------------------------------

drop function if exists public.join_group(text);

create or replace function public.join_group(
  p_code text,
  p_invited_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Fixed referral bonus. Lives only in group_referrals, never in scores, so
  -- its value has no effect on competitive ranking and can be tuned later.
  c_referral_bonus constant int := 50;
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_inviter uuid;
  v_inserted boolean := false;
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

  -- Resolve a usable inviter: never self-credit, and only an existing member of
  -- this group counts (drops strangers / fabricated ids). null otherwise.
  if p_invited_by is not null and p_invited_by <> v_uid then
    if exists (
      select 1 from public.group_members
      where group_id = v_group_id and user_id = p_invited_by
    ) then
      v_inviter := p_invited_by;
    end if;
  end if;

  -- Idempotent membership insert. The CTE reports whether a NEW row was created
  -- (re-joins hit on conflict do nothing, returning no row), so we only stamp
  -- the inviter and award on a genuine first join — never overwriting an
  -- existing invited_by_user_id.
  with ins as (
    insert into public.group_members (group_id, user_id, role, invited_by_user_id)
    values (v_group_id, v_uid, 'member', v_inviter)
    on conflict (group_id, user_id) do nothing
    returning 1
  )
  select exists (select 1 from ins) into v_inserted;

  -- Referral block: only on a real first join with a valid, distinct,
  -- already-member inviter. unique (group_id, invitee_id) + do nothing keeps
  -- the award single even under races.
  if v_inserted and v_inviter is not null then
    insert into public.group_referrals (group_id, inviter_id, invitee_id, points)
    values (v_group_id, v_inviter, v_uid, c_referral_bonus)
    on conflict (group_id, invitee_id) do nothing;
  end if;

  return v_group_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. The dropped single-arg overload took its grant with it; re-grant the
-- new two-arg signature to authenticated.
-- ---------------------------------------------------------------------------

grant execute on function public.join_group(text, uuid) to authenticated;
