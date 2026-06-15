## Context

The match-detail page (`app/[locale]/(public)/matches/[matchId]/page.tsx`) is a fetch-once server component: it reads the `matches` row and renders a frozen scoreboard. Live data exists only on the landing page via `LiveMatchList`, which polls `/api/live-matches` every 30s with a hand-rolled visibility/idle loop. Match data is written by the result sync (`lib/result-sync/`), which today persists **only an aggregate score + status** through an ordered provider chain (Football-Data.org primary, ESPN keyless fallback). There is no event-level data anywhere and no `match_events` table.

We want the match-detail page to (a) constantly refresh score/status while a match is in progress and (b) show a play-by-play feed (goals, cards, subs, period markers). The user picked **full events feed + live score**, sourced from **ESPN play-by-play**.

Constraints: Vercel Hobby cron is daily-only (sub-minute cron needs Pro). The architecture is polling-based — no websockets/Realtime today. Football-Data.org's free tier does not expose play-by-play; ESPN's keyless event/summary endpoint does.

## Goals / Non-Goals

**Goals:**
- A `match_events` timeline model and idempotent ingestion of ESPN play-by-play events alongside the existing score/status write.
- A per-match live API returning current score/status + ordered events, `no-store`.
- A match-detail feed component that polls while live, updates the score in place, and renders the event timeline accessibly.
- Keep the feed fresh without a paid sub-minute cron, reusing the established opportunistic-sync pattern.
- One shared polling hook used by both `LiveMatchList` and the new feed — no duplicated loops.

**Non-Goals:**
- Websockets / Supabase Realtime / SSE.
- Backfilling events for already-final matches.
- Lineups, rosters, player stats, win-probability.
- Events on the landing `LiveMatchList` rows (stays score-only).

## Decisions

### Polling, not Realtime
Keep the polling model. The data already arrives via server-side sync writes; a client subscription would still need that write to happen first, so Realtime adds connection/RLS-broadcast complexity for no freshness gain. **Alternative considered:** Supabase Realtime on `match_events` — rejected: extra client lib surface, RLS broadcast config, and reconnect handling for a feature that updates on a ~15s human timescale.

### ESPN as the event source, decoupled from the score write
The score/status mapping (Football-Data primary) is unchanged. A new event-ingestion step parses ESPN's summary payload (`plays`/key events) into normalized `MatchEvent` rows and upserts them. Event ingestion is **isolated**: its failure logs and is swallowed, never aborting or rolling back the score sync (same isolation contract the email step already follows). **Alternative:** parse events from Football-Data — rejected: not available on the free tier.

### Freshness via opportunistic per-match live sync (no Pro cron)
The live API, when hit for an in-progress match, schedules a **debounced ESPN event+score sync scoped to that match** after the response is sent (mirrors the existing matches-page opportunistic trigger, but per-match and on a tighter ~15–20s debounce). No viewer ⇒ no sync needed; the daily cron still finalizes. **Alternatives:** `*/1` Vercel cron (needs Pro, global not per-match, runs with zero viewers) or client-driven write (rejected: clients must not write).

### `match_events` schema
```
match_events(
  id              uuid pk default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  provider        text not null default 'espn',
  provider_event_id text,            -- ESPN play id; null when synthesized
  type            text not null,     -- goal | own_goal | penalty_goal | penalty_missed | yellow | red | yellow_red | substitution | period_start | period_end | var | other
  team            text check (team in ('home','away')),  -- null for neutral (period markers, VAR)
  minute          smallint,          -- clock minute; null pre-kickoff
  extra_minute    smallint,          -- stoppage (45+2 → minute=45, extra=2)
  sequence        integer not null,  -- monotonic order within the match (from provider sequence/clock)
  player          text,
  detail          text,              -- short provider description, used as fallback label
  payload         jsonb,             -- raw provider event for forward-compat / debugging
  created_at      timestamptz not null default now()
)
unique (match_id, provider, provider_event_id)   -- idempotent upsert key
index (match_id, sequence)
```
Dedupe/idempotency via the unique key → re-syncs `on conflict do update`. Ordering by `sequence` (fallback `minute, extra_minute`). RLS: public `select` (like `matches`); writes only via service role used by the sync.

### Live API shape — `GET /api/matches/[matchId]/live`
Returns `{ matchId, status, homeScore, awayScore, kickoffAt, isLive, updatedAt, events: MatchEvent[] }`, `Cache-Control: no-store`. `isLive` reuses the existing `isLiveNow()` helper. Full event list is returned (a match has tens of events — cheap); the client replaces and diffs by `id` to animate new entries. Triggers the opportunistic per-match sync when `isLive`.

### Shared `useLivePolling` hook
Extract the loop from `LiveMatchList` into `hooks/use-live-polling.ts`: `{ url, intervalMs, enabled, stopWhen(data), onData }` with visibility pause, immediate refetch on tab focus, idle stop, and `AbortController` cancel-on-unmount. `LiveMatchList` refactors onto it (30s, list `stopWhen`); the feed uses it (15s, `stopWhen` = status final). Behavior parity for `LiveMatchList` is required (no regression).

### Event rendering & i18n
Events render as icon + minute + player/team — language-neutral except the event-type **label**, localized client-side from the `type` enum (`en`/`es`/`fr` catalogs). Player/team strings come from the provider as-is. Feed exposes one `aria-live="polite"` region; new entries animate in (motion-safe).

## Risks / Trade-offs

- **ESPN event coverage/quality varies per match** → feed is additive; score remains Football-Data-authoritative; empty/partial feed renders a graceful "no events yet" state.
- **Per-match poll fan-out / ESPN rate limits** → server-side per-match debounce on the sync trigger; client 15s interval with visibility pause + abort; only in-progress matches poll.
- **Opportunistic trigger fires only while someone watches** → acceptable: no viewer ⇒ no freshness need; daily cron still finalizes scores/emails.
- **Per-instance in-memory debounce** (serverless) → same known limitation as the existing opportunistic sync; bounded worst case is one ESPN fetch per instance per debounce window.
- **Duplicate/renumbered events on re-sync** → unique `(match_id, provider, provider_event_id)` upsert; `payload` retained for reconciliation.
- **Event step regressing the score sync** → ingestion wrapped in try/catch, counted in the run summary, never blocks or rolls back score writes.

## Migration Plan

1. Ship additive migration creating `match_events` (+ indexes, RLS). No change to `matches`; fully backward compatible.
2. Deploy sync event-ingestion (guarded) + live API + feed component + hook refactor.
3. Rollback: unmount the feed from the detail page and stop event ingestion; the table can be dropped independently. Score sync is unaffected at every step.

## Open Questions

- Exact ESPN summary endpoint per competition — reuse the competition `providers` JSONB (same pattern as the score URLs) rather than hardcoding.
- Final surfaced event-type set (penalty shootout entries? VAR overturns?) — start with goals/cards/subs/period markers; `payload` lets us expand without a migration.
