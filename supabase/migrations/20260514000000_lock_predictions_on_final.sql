-- ===========================================================================
-- Lock predictions when match leaves the 'scheduled' state
-- ===========================================================================
--
-- The two existing predictions policies only check `m.kickoff_at > now()`. If
-- an admin shifts a finalized/cancelled match's kickoff_at into the future
-- (correction, reschedule, import bug), users could overwrite a prediction on
-- a match whose result is already known. Tighten both policies to also require
-- `m.status = 'scheduled'` so a non-scheduled match is permanently immutable.

drop policy if exists "predictions_insert_own_before_kickoff" on public.predictions;
drop policy if exists "predictions_update_own_before_kickoff" on public.predictions;

create policy "predictions_insert_own_before_kickoff"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.status = 'scheduled'
        and m.kickoff_at > now()
    )
  );

create policy "predictions_update_own_before_kickoff"
  on public.predictions for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.status = 'scheduled'
        and m.kickoff_at > now()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.status = 'scheduled'
        and m.kickoff_at > now()
    )
  );
