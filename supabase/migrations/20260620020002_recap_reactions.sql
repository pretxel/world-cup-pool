-- ===========================================================================
-- recap_reactions: authenticated emoji reactions on recap comics
-- ---------------------------------------------------------------------------
-- When a match reaches `final`, lib/match-summary.ts publishes an active recap
-- (public.match_summaries.is_active) and an async Leonardo render produces a
-- 4-panel comic (public.match_summary_images). This table lets a signed-in user
-- add a lightweight emoji reaction (a tap) to the ACTIVE recap version of a
-- FINAL match, and surfaces public, anonymous-readable aggregate counts.
--
-- Scoping mirrors how match_summary_images exposes only the active render:
--   * Writes are accepted only for the active version (match_summaries.is_active)
--     of a final match (matches.status = 'final'), enforced in SQL so the gate
--     holds regardless of which client writes.
--   * Public counts (v_recap_reaction_counts) expose only active-version rows.
--
-- Anti-inflation guardrail: unique (user_id, summary_id, reaction) — a user can
-- hold each reaction type at most once per recap version, so a count cannot be
-- inflated by a single user.
--
-- Reactions are purely social. They carry NO points and NEVER touch
-- public.scores, compute_match_scores(), predictions, or any leaderboard view;
-- reacting or un-reacting cannot change any player's standing.
-- ===========================================================================

create table public.recap_reactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  summary_id uuid not null references public.match_summaries(id) on delete cascade,
  -- Denormalized for the cheap landing-gallery aggregate (sum per active match)
  -- and for match-scoped reads without a join.
  match_id   uuid not null references public.matches(id) on delete cascade,
  -- Fixed allowlist: a tap, never free text. Keep in sync with REACTION_TYPES in
  -- lib/recap-reactions.ts and the server-side re-check in toggle_recap_reaction.
  reaction   text not null
               check (reaction in ('fire', 'goal', 'shock', 'laugh', 'clap', 'sad')),
  created_at timestamptz not null default now(),
  -- Anti-inflation: each (user, recap version, reaction) at most once.
  constraint recap_reactions_user_summary_reaction_uq
    unique (user_id, summary_id, reaction)
);

-- Counts per active recap version.
create index recap_reactions_summary_id_idx on public.recap_reactions (summary_id);
-- The viewer's own selected reactions.
create index recap_reactions_user_summary_idx on public.recap_reactions (user_id, summary_id);
-- Landing-gallery aggregate summed per match.
create index recap_reactions_match_id_idx on public.recap_reactions (match_id);

-- ---------------------------------------------------------------------------
-- RLS: own-row only. An authenticated user may select/insert/delete only rows
-- whose user_id = auth.uid(); writes are additionally gated to the active
-- version of a final match. Aggregate counts are exposed ONLY through the
-- public counts view below, never by a broad row-select grant. The service role
-- bypasses RLS for admin/cleanup paths.
-- ---------------------------------------------------------------------------

alter table public.recap_reactions enable row level security;

-- The viewer reads their own reactions (to show selected state).
create policy "recap_reactions_select_own"
  on public.recap_reactions
  for select
  to authenticated
  using (user_id = auth.uid());

-- Insert own row, only for the active version of a final match (same exists(...)
-- shape as match_summary_images_select_public, plus the matches join).
create policy "recap_reactions_insert_own_active_final"
  on public.recap_reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.match_summaries s
      join public.matches m on m.id = s.match_id
      where s.id = recap_reactions.summary_id
        and s.match_id = recap_reactions.match_id
        and s.is_active
        and m.status = 'final'
    )
  );

-- Delete own row. The active/final gate is intentionally NOT applied to delete:
-- a user must always be able to remove a reaction they added, even if the recap
-- has since been re-rendered to a new active version.
create policy "recap_reactions_delete_own"
  on public.recap_reactions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Public, active-version-scoped counts. security_invoker = off (pinned, like
-- v_quiz_questions_public) so the view runs with owner rights and can aggregate
-- past the own-row select RLS while exposing ONLY counts — never which user
-- reacted. Draft / non-active versions are excluded.
-- ---------------------------------------------------------------------------
create or replace view public.v_recap_reaction_counts
  with (security_invoker = off) as
select
  r.summary_id,
  r.match_id,
  r.reaction,
  count(*)::int as count
from public.recap_reactions r
where exists (
  select 1
  from public.match_summaries s
  where s.id = r.summary_id
    and s.is_active
)
group by r.summary_id, r.match_id, r.reaction;

grant select on public.v_recap_reaction_counts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Per-user rate limit on toggle churn. The unique constraint bounds the steady
-- state (one row per type), so this only guards flip-spam. A SECURITY DEFINER
-- toggle function counts a rolling window before applying the insert/delete and
-- rejects abusive churn — same posture as the group_invite_log caps. It also
-- re-checks the allowlist and re-asserts the active/final scope server-side
-- (defense in depth alongside the table check + RLS), and returns the
-- authoritative per-type counts so the optimistic client can reconcile.
-- ---------------------------------------------------------------------------

create or replace function public.toggle_recap_reaction(
  p_summary_id uuid,
  p_reaction text,
  p_on boolean
)
returns table (reaction text, count int)
language plpgsql
security definer
set search_path = public
as $$
  -- The RETURNS TABLE columns (reaction, count) shadow the recap_reactions
  -- columns; prefer the column on any unqualified reference so the ON CONFLICT
  -- target `reaction` is the column, not the OUT variable ("column reference
  -- reaction is ambiguous" otherwise).
  #variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_match_id uuid;
  v_recent int;
  -- Rolling window + cap for flip-spam protection.
  c_window interval := interval '1 minute';
  c_max_toggles int := 20;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Defense in depth: re-check the allowlist server-side.
  if p_reaction not in ('fire', 'goal', 'shock', 'laugh', 'clap', 'sad') then
    raise exception 'reaction not allowed';
  end if;

  -- Re-assert active-version + final-match scoping, and resolve match_id from
  -- the summary so the caller cannot spoof it.
  select s.match_id
    into v_match_id
  from public.match_summaries s
  join public.matches m on m.id = s.match_id
  where s.id = p_summary_id
    and s.is_active
    and m.status = 'final';

  if v_match_id is null then
    raise exception 'recap not reactable';
  end if;

  -- Rate limit: count this user's recently-created reaction rows as a churn
  -- proxy. This bounds rapid re-adds (the abusive flip pattern) without blocking
  -- the steady state (one row per type, enforced by the unique constraint).
  select count(*)
    into v_recent
  from public.recap_reactions r
  where r.user_id = v_uid
    and r.created_at > now() - c_window;

  if v_recent >= c_max_toggles then
    raise exception 'rate limit exceeded';
  end if;

  if p_on then
    insert into public.recap_reactions (user_id, summary_id, match_id, reaction)
    values (v_uid, p_summary_id, v_match_id, p_reaction)
    on conflict (user_id, summary_id, reaction) do nothing;
  else
    delete from public.recap_reactions r
    where r.user_id = v_uid
      and r.summary_id = p_summary_id
      and r.reaction = p_reaction;
  end if;

  -- Return the authoritative per-type counts for this (active) recap version so
  -- the client reconciles its optimistic update against the truth.
  return query
    select r.reaction, count(*)::int as count
    from public.recap_reactions r
    where r.summary_id = p_summary_id
    group by r.reaction;
end;
$$;

grant execute on function public.toggle_recap_reaction(uuid, text, boolean) to authenticated;
