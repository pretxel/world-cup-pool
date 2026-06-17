-- ---------------------------------------------------------------------------
-- match_summary_images: one rendered image per recap version, produced from
-- match_summaries.image_prompt via Leonardo.ai (gpt-image-2). The render is
-- async: a row is created `pending` when the generation is requested, then moved
-- to `complete` (with the stored object path) by the webhook/poll, or `failed`.
-- Correlated back to the async result by the Leonardo `generation_id`.
-- ---------------------------------------------------------------------------

create table public.match_summary_images (
  id            uuid primary key default gen_random_uuid(),
  summary_id    uuid not null references public.match_summaries (id) on delete cascade,
  match_id      uuid not null references public.matches (id) on delete cascade,
  provider      text not null default 'leonardo',
  model         text,
  -- Leonardo generation id; the webhook + poll look the row up by this. Nullable
  -- because a request that fails before Leonardo returns an id records `failed`.
  generation_id text,
  status        text not null default 'pending'
                  check (status in ('pending', 'complete', 'failed')),
  storage_path  text,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One render per recap version; a re-render updates this row in place.
  constraint match_summary_images_summary_uq unique (summary_id)
);

-- One render row per Leonardo job. Partial so multiple `failed`/pre-request rows
-- (generation_id null) don't collide.
create unique index match_summary_images_generation_id_uq
  on public.match_summary_images (generation_id)
  where generation_id is not null;

create trigger trg_match_summary_images_updated_at
  before update on public.match_summary_images
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: public read mirrors recap visibility — only the ACTIVE version's render
-- is exposed; draft renders stay hidden. Writes are service-role only (the role
-- bypasses RLS, so no write policy is defined).
-- ---------------------------------------------------------------------------

alter table public.match_summary_images enable row level security;

create policy "match_summary_images_select_public"
  on public.match_summary_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.match_summaries s
      where s.id = match_summary_images.summary_id
        and s.is_active
    )
  );

-- ---------------------------------------------------------------------------
-- Public storage bucket holding the rendered images. The active version's image
-- is served by its public URL; the service role (webhook/poll) is the only
-- writer, so only a public SELECT policy on the bucket's objects is needed.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('match-recap-images', 'match-recap-images', true)
on conflict (id) do nothing;

create policy "match_recap_images_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'match-recap-images');
