-- ---------------------------------------------------------------------------
-- matches_realtime_publication: emit Realtime change events for public.matches
--
-- The bracket page is server-rendered from public.matches (allocation,
-- provisional projections, and match-number resolution all happen on the
-- server, which stays the single source of truth). Supabase Realtime
-- postgres_changes operates on base tables in the supabase_realtime
-- publication, so the bracket client listens to the public.matches base table
-- and treats any change there as "the bracket may have changed", then triggers
-- a server refresh (router.refresh()).
--
-- This adds public.matches to the supabase_realtime publication. No schema or
-- RLS change is made here: the existing matches_select_public policy already
-- governs who receives change events.
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
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end
$$;
