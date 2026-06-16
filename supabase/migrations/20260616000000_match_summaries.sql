-- ---------------------------------------------------------------------------
-- match_summaries: one AI-generated recap per match, produced after the match
-- reaches status='final'. Grounded in the match_events timeline + final score.
-- Aggregate score/status stays on public.matches; this table only carries the
-- narrative recap (provider: OpenRouter).
-- ---------------------------------------------------------------------------

create table public.match_summaries (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references public.matches (id) on delete cascade,
  content           text not null,
  provider          text not null default 'openrouter',
  model             text,
  prompt_tokens     integer,
  completion_tokens integer,
  -- Recap language. Generated in English today; column leaves room to expand.
  locale            text not null default 'en',
  generated_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- One summary per match. The unique constraint doubles as the match_id lookup
  -- index (Postgres builds a unique index for it), so no separate index needed.
  constraint match_summaries_match_uq unique (match_id)
);

create trigger trg_match_summaries_updated_at
  before update on public.match_summaries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: public read (mirrors public.matches / public.match_events); writes only
-- via the service role used by the sync (service role bypasses RLS, so no write
-- policy is defined).
-- ---------------------------------------------------------------------------

alter table public.match_summaries enable row level security;

create policy "match_summaries_select_public"
  on public.match_summaries
  for select
  to anon, authenticated
  using (true);
