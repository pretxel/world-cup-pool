-- ---------------------------------------------------------------------------
-- match_events: per-match play-by-play timeline (goals, cards, subs, markers)
-- The first event-level data in the product. Aggregate score/status stays on
-- public.matches; this table only carries the timeline, sourced from ESPN.
-- ---------------------------------------------------------------------------

create table public.match_events (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references public.matches (id) on delete cascade,
  provider          text not null default 'espn',
  provider_event_id text,
  type              text not null,
  team              text check (team is null or team in ('home', 'away')),
  minute            smallint,
  extra_minute      smallint,
  sequence          integer not null default 0,
  player            text,
  detail            text,
  payload           jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- idempotent upsert key: re-syncing the same provider event updates in place
  constraint match_events_provider_event_uq
    unique (match_id, provider, provider_event_id)
);

-- ordering within a match (the live API reads events ordered by sequence)
create index match_events_match_sequence_idx
  on public.match_events (match_id, sequence);

create trigger trg_match_events_updated_at
  before update on public.match_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: public read (mirrors public.matches); writes only via the service role
-- used by the sync (service role bypasses RLS, so no write policy is defined).
-- ---------------------------------------------------------------------------

alter table public.match_events enable row level security;

create policy "match_events_select_public"
  on public.match_events
  for select
  to anon, authenticated
  using (true);
