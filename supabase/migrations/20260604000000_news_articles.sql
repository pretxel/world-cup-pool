-- ===========================================================================
-- World Cup 2026 Pool — news_articles
-- Cached external WC2026 headlines. Written only by the sync-news cron
-- (service role); publicly readable. Cards link out to the source.
-- ===========================================================================

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  -- Stable dedup key: provider id when present, else a normalized source URL.
  -- Unique so repeated cron runs upsert instead of inserting duplicates.
  dedup_key text not null unique,
  external_id text,
  -- Only http(s) links are ever stored — the feed is untrusted and this URL is
  -- rendered into an <a href>. App-layer validation (lib/news.ts) is the first
  -- guard; this CHECK is the backstop.
  source_url text not null check (source_url ~* '^https?://'),
  title text not null check (char_length(title) > 0),
  summary text,
  image_url text,
  source text,
  published_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index news_articles_published_at_idx
  on public.news_articles (published_at desc);

create trigger trg_news_articles_updated_at
  before update on public.news_articles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: public read, no public write. Only the service-role cron writes
-- (service role bypasses RLS), so no insert/update/delete policy is defined.
-- ---------------------------------------------------------------------------
alter table public.news_articles enable row level security;

create policy "news_articles_select_public"
  on public.news_articles for select
  to anon, authenticated
  using (true);
