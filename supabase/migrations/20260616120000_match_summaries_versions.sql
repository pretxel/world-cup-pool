-- ---------------------------------------------------------------------------
-- Recap versioning: a match may hold multiple recap versions; exactly one is
-- active (the version published to viewers). This drops the at-most-one-per-
-- match unique constraint, adds style + active columns, backfills existing rows
-- as the active 'neutral' version, and narrows public reads to the active row so
-- draft versions never leak to anon/authenticated reads.
-- ---------------------------------------------------------------------------

-- Drop the old at-most-one constraint (it also served as the match_id index).
alter table public.match_summaries
  drop constraint match_summaries_match_uq;

-- Style + active columns. style_key identifies the recap style (preset key or
-- 'custom'); style_instruction records the exact guidance injected into the
-- prompt (null for the default 'neutral' style).
alter table public.match_summaries
  add column style_key         text not null default 'neutral',
  add column style_instruction text,
  add column is_active         boolean not null default false;

-- Existing single recap becomes the active, neutral version (each match has at
-- most one row today, so the partial unique index below holds).
update public.match_summaries set is_active = true;

-- At most one active version per match.
create unique index match_summaries_active_uq
  on public.match_summaries (match_id)
  where is_active;

-- Replace the match_id lookup index the dropped unique constraint provided.
create index match_summaries_match_id_idx
  on public.match_summaries (match_id);

-- ---------------------------------------------------------------------------
-- RLS: narrow public read to the active version. Admin paths use the service
-- role (bypasses RLS) and continue to see every version.
-- ---------------------------------------------------------------------------

drop policy "match_summaries_select_public" on public.match_summaries;

create policy "match_summaries_select_public"
  on public.match_summaries
  for select
  to anon, authenticated
  using (is_active);
