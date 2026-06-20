-- ---------------------------------------------------------------------------
-- recap_reactions_realtime_publication: emit Realtime change events for
-- public.recap_reactions
--
-- The match-detail reaction bar reads aggregate counts from
-- v_recap_reaction_counts. Supabase Realtime postgres_changes operates on base
-- tables in the supabase_realtime publication; a view cannot be subscribed to
-- directly. So the bar listens to the public.recap_reactions base table and
-- treats any change there as "the counts may have changed", then re-fetches the
-- authoritative counts (with a debounce), exactly like the leaderboard listens
-- to public.scores and re-fetches v_leaderboard_overall.
--
-- No schema, view, or RLS change is made here: the existing own-row select RLS
-- governs which change events authenticated subscribers receive; anon clients
-- receive no row-level delivery (RLS-scoped) and fall back to the SSR snapshot.
-- Additive and optional — if Realtime is disabled, the SSR snapshot and the
-- post-toggle re-fetch keep the bar correct.
-- ---------------------------------------------------------------------------

-- Idempotent guard: only add the table when it is not already a publication
-- member, so re-running this migration is safe.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recap_reactions'
  ) then
    alter publication supabase_realtime add table public.recap_reactions;
  end if;
end
$$;
