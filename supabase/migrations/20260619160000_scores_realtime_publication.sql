-- ---------------------------------------------------------------------------
-- scores_realtime_publication: emit Realtime change events for public.scores
--
-- The global leaderboard is the view v_leaderboard_overall, which aggregates
-- public.scores. Supabase Realtime postgres_changes operates on base tables in
-- the supabase_realtime publication; a view cannot be subscribed to directly.
-- So the leaderboard client listens to the public.scores base table and treats
-- any change there as "the board may have changed", then re-fetches the view.
--
-- This adds public.scores to the supabase_realtime publication. No schema, view,
-- or RLS change is made here: the existing scores_select_authenticated policy
-- (to authenticated using (true)) already governs who receives change events.
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
      and tablename = 'scores'
  ) then
    alter publication supabase_realtime add table public.scores;
  end if;
end
$$;
