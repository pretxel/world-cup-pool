## Why

The match-detail page (`/matches/[matchId]`) server-renders once and never updates: a user watching a live match sees a frozen score and no sense of what is happening on the pitch until they manually reload. Today the only live data anywhere is the landing page's `LiveMatchList` (score-only, 30s poll). There is no event-level data (goals, cards, subs) in the product at all — the `matches` table holds a single aggregate score. We want the match page to feel alive: a constantly-refreshing score/status plus a play-by-play feed of what just happened.

## What Changes

- Add a **`match_events`** table (goal, card, substitution, period start/end, etc.) keyed to a match, with an ordered timeline (minute/sequence) — the first event-level data in the product.
- Extend the result sync to **ingest play-by-play events from ESPN's keyless summary endpoint** into `match_events` alongside the existing score/status write, normalized like the current provider chain. Football-Data.org stays the primary score source; ESPN supplies the event timeline.
- Add a **live match API** (`/api/matches/[matchId]/live`) returning current score/status + the event timeline for one match, `no-store`. When hit for a live match it **opportunistically triggers a debounced ESPN event sync** so the feed stays fresh without a paid sub-minute cron (mirrors the existing opportunistic-sync pattern).
- Add a **`LiveEventsFeed`** client component on the match-detail page that polls the live API while the match is in progress, updates the score/status in place, and renders the event timeline (newest first, animated in, `aria-live`). It stops once the match is `final` and pauses when the tab is hidden.
- Extract the smart-polling logic currently inline in `LiveMatchList` into a **shared `useLivePolling` hook** (visibility pause/resume, idle stop, in-flight cancel) reused by both the landing list and the new feed — no duplicated polling loops.

- **Out of scope**: websockets / Supabase Realtime (polling only, consistent with the current architecture); historical event backfill for already-final matches; events on the landing `LiveMatchList` rows (score-only there stays); player rosters/lineups.

## Capabilities

### New Capabilities
- `live-match-feed`: a constantly-refreshing match-detail experience — live score/status polling plus a play-by-play event timeline backed by a new `match_events` model, a per-match live API, and a shared polling hook.

### Modified Capabilities
- `automated-results`: the sync gains a second responsibility — fetching and persisting per-match play-by-play events from ESPN, and an opportunistic live-event sync path for in-progress matches that runs more frequently than the daily cron.

## Impact

- **DB**: new `supabase/migrations/<ts>_match_events.sql` (`match_events` table + indexes + RLS read policy). No change to `matches` columns.
- **Sync**: `lib/result-sync/providers/espn.ts` (add event parsing), `lib/result-sync/core.ts` (persist events), new `lib/result-sync/events.ts` + opportunistic live-event trigger.
- **API**: new `app/api/matches/[matchId]/live/route.ts` (`no-store`).
- **UI**: new `components/live-events-feed.tsx`; match-detail `page.tsx` mounts it for non-final matches; `components/live-match-list.tsx` refactored onto the shared hook; new `hooks/use-live-polling.ts`.
- **i18n**: new event-type / feed labels added to `en`/`es`/`fr` message catalogs (feed UI is the only on-page text; events themselves render as icons + minute + names).
- No breaking changes. No new dependencies (ESPN is keyless and already wired as the fallback provider).
