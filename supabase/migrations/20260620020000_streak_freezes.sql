-- ===========================================================================
-- Streak freeze / weekly pass — per-user, per-kind freeze ledger
-- ---------------------------------------------------------------------------
-- Both engagement streaks are PURE functions computed on read from raw
-- timestamps (`computeStreak` in lib/quiz.ts, `computePredictionStreak` in
-- lib/prediction-streak.ts). A single missed UTC day zeroes the run — the
-- "cliff" that kills most streaks. A freeze forgives exactly one isolated
-- one-day gap so the streak survives.
--
-- A naive `profiles.weekly_streak_passes` integer cannot work: a single counter
-- cannot say *which* gap was forgiven, so a later read (the gap still present in
-- the timestamps) would either re-break the streak or re-charge a freeze. The
-- freeze is therefore a LEDGER the pure functions consult, recording two row
-- classes per (user, kind, kind ∈ {quiz, prediction}):
--
--   * grants       — one row per (user, kind, week_start) capturing how many
--                    freezes the user holds for that Monday-anchored UTC week.
--   * consumptions — one row per (user, kind, consumed_day) recording the exact
--                    UTC day a freeze bridged.
--
-- A single table with a `row_kind` discriminator carries both. The partial
-- unique index on consumption rows over (user_id, kind, consumed_day) makes
-- consumption IDEMPOTENT: re-reading the same gap inserts nothing and never
-- double-charges, safe under concurrent reads.
--
-- RLS: owner-only SELECT (`user_id = auth.uid()`). NO client insert/update/
-- delete — grants are minted and consumptions recorded only through the
-- `security definer` RPCs below, so a client cannot fabricate freezes. Purely
-- additive; no existing table is altered. No new cron: the weekly grant and the
-- gap consumption are computed lazily on existing read paths.
-- ===========================================================================

create table public.streak_freezes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'quiz' | 'prediction' — independent budgets per streak.
  kind text not null check (kind in ('quiz', 'prediction')),
  -- 'grant' | 'consumption' — which ledger row class this is.
  row_kind text not null check (row_kind in ('grant', 'consumption')),
  -- Grants only: Monday 00:00:00 UTC of the week this allowance covers.
  week_start date,
  -- Grants only: how many freezes were granted for that week.
  amount smallint,
  -- Consumptions only: the exact UTC day a freeze bridged.
  consumed_day date,
  created_at timestamptz not null default now(),
  -- Shape integrity: grant rows carry (week_start, amount); consumption rows
  -- carry (consumed_day). Never both.
  constraint streak_freezes_grant_shape check (
    (row_kind = 'grant' and week_start is not null and amount is not null
       and consumed_day is null)
    or
    (row_kind = 'consumption' and consumed_day is not null
       and week_start is null and amount is null)
  )
);

-- At most one grant row per (user, kind, week) — the lazy weekly refill is an
-- insert-if-missing guarded by this constraint.
create unique index streak_freezes_grant_uniq
  on public.streak_freezes (user_id, kind, week_start)
  where row_kind = 'grant';

-- IDEMPOTENT consumption: the same gap day can be charged at most once, ever.
create unique index streak_freezes_consumption_uniq
  on public.streak_freezes (user_id, kind, consumed_day)
  where row_kind = 'consumption';

-- Owner reads (remaining-allowance + consumed-day lookups on the page paths).
create index streak_freezes_user_kind_idx
  on public.streak_freezes (user_id, kind);

alter table public.streak_freezes enable row level security;

-- Owner-only SELECT. No INSERT/UPDATE/DELETE policy → clients can never write
-- this ledger directly; minting/consumption happens only through the definer
-- RPCs below (or the service-role key, which bypasses RLS, for the email path).
create policy streak_freezes_owner_select
  on public.streak_freezes
  for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lazy weekly grant. Insert-if-missing the current week's grant row for the
-- calling user + kind. Idempotent via streak_freezes_grant_uniq. Returns the
-- amount granted for the current week.
-- ---------------------------------------------------------------------------
create or replace function public.grant_streak_freeze(p_kind text, p_amount smallint)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_week_start date;
  v_amount smallint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_kind not in ('quiz', 'prediction') then
    raise exception 'invalid kind';
  end if;

  -- Monday 00:00:00 UTC of the current week (date_trunc('week') is Monday-based).
  v_week_start := (date_trunc('week', (now() at time zone 'utc')))::date;

  insert into public.streak_freezes (user_id, kind, row_kind, week_start, amount)
  values (v_uid, p_kind, 'grant', v_week_start, p_amount)
  on conflict (user_id, kind, week_start) where row_kind = 'grant'
  do nothing;

  select amount into v_amount
  from public.streak_freezes
  where user_id = v_uid and kind = p_kind and row_kind = 'grant'
    and week_start = v_week_start;

  return coalesce(v_amount, p_amount);
end;
$$;

-- ---------------------------------------------------------------------------
-- Idempotent consumption. Records that a freeze bridged `p_consumed_day` for
-- the calling user + kind, but only if a freeze remains this week (granted this
-- week minus consumptions whose day falls in this week's window). Returns true
-- when a row was newly recorded OR already existed for that day (the gap is
-- protected), false when no allowance remained. The unique index guards against
-- double-charge under concurrent reads.
-- ---------------------------------------------------------------------------
create or replace function public.consume_streak_freeze(p_kind text, p_consumed_day date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_week_start date;
  v_week_end date;
  v_granted smallint;
  v_used integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_kind not in ('quiz', 'prediction') then
    raise exception 'invalid kind';
  end if;

  v_week_start := (date_trunc('week', (now() at time zone 'utc')))::date;
  v_week_end := v_week_start + 7;

  -- Already consumed for this day → idempotent success, nothing to charge.
  perform 1 from public.streak_freezes
  where user_id = v_uid and kind = p_kind and row_kind = 'consumption'
    and consumed_day = p_consumed_day;
  if found then
    return true;
  end if;

  select coalesce(amount, 0) into v_granted
  from public.streak_freezes
  where user_id = v_uid and kind = p_kind and row_kind = 'grant'
    and week_start = v_week_start;
  v_granted := coalesce(v_granted, 0);

  select count(*) into v_used
  from public.streak_freezes
  where user_id = v_uid and kind = p_kind and row_kind = 'consumption'
    and consumed_day >= v_week_start and consumed_day < v_week_end;

  if v_used >= v_granted then
    return false;
  end if;

  insert into public.streak_freezes (user_id, kind, row_kind, consumed_day)
  values (v_uid, p_kind, 'consumption', p_consumed_day)
  on conflict (user_id, kind, consumed_day) where row_kind = 'consumption'
  do nothing;

  -- Either we inserted it, or a concurrent request did — the day is protected.
  return true;
end;
$$;

grant execute on function public.grant_streak_freeze(text, smallint) to authenticated;
grant execute on function public.consume_streak_freeze(text, date) to authenticated;
