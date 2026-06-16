## Why

The landing page "Tournament live" section polls every ~30s and faithfully renders
whatever score the database holds — but nothing refreshes that database for the
landing path. The poll endpoint `GET /api/live-matches` is read-only: unlike the
per-match live route (which schedules an opportunistic result sync), the landing
endpoint never pulls fresh scores from the upstream provider. So a live fixture
(e.g. Iraq vs Norway) stays frozen at its seeded `0–0` for every visitor until the
cron happens to run or someone opens that match's detail page. The most-visited,
most-public surface shows stale scores.

## What Changes

- `GET /api/live-matches` schedules an opportunistic result sync for the fixtures it
  reports as currently live, on the same non-blocking, throttled mechanism the
  per-match live route already uses (`maybeScheduleMatchSync`). The response still
  returns the current DB snapshot immediately; the freshly synced score lands on the
  next ~30s poll.
- The sync fan-out is bounded: only currently-live fixtures are scheduled, capped to a
  small N per request, and de-duplicated by the existing per-match 15s throttle so
  many concurrent visitors do not multiply provider calls.
- Terminal fixtures (`final`/`cancelled`) and the next-up fallback fixture are never
  scheduled — only fixtures that are actually in play.
- No change to the rendered shape, polling cadence, or visual design of the live
  section; this is purely making the data the section already polls actually move.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `landing-live-matches`: add a requirement that the landing live data source keeps
  scores current by triggering an opportunistic, throttled, non-blocking result sync
  for the currently-live fixtures it serves (so polled scores actually advance), while
  preserving the existing read semantics, ordering, and next-up behavior.

## Impact

- **API:** `app/api/live-matches/route.ts` (the landing poll endpoint) — add the
  opportunistic sync scheduling after building the payload.
- **Reused, unchanged:** `lib/result-sync/opportunistic.ts` (`maybeScheduleMatchSync`,
  its 15s per-match throttle, `after()` scheduling), `lib/result-sync/core.ts`
  (`runMatchSync`), `lib/matches/live.ts` (`getLiveAndNextUp`, `isLiveNow`).
- **Behavior:** provider (ESPN) calls now also originate from landing traffic, bounded
  by the existing throttle + a per-request cap; no schema, no migration.
- **Tests:** the landing route gains coverage that it schedules syncs for live
  fixtures only (not terminal/next-up) and stays non-blocking.
