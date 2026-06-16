## Context

The landing "Tournament live" section renders an initial server snapshot
(`TournamentCountdown` → `getLiveAndNextUp`) and then `LiveMatchList` polls
`GET /api/live-matches` every ~30s via `useLivePolling`. That endpoint is a pure read:
it calls `getLiveAndNextUp(competitionId)` (which filters matches with `isLiveNow`) and
returns `{ live, nextUp }` with `Cache-Control: no-store`. It never refreshes the
underlying `matches` rows.

Score freshness today comes from two places only:
- The cron `GET /api/cron/sync-matches` → `runSync()` (all matches, on a schedule).
- The per-match live route `GET /api/matches/[matchId]/live`, which already calls
  `maybeScheduleMatchSync({ id, status })` when the match is live.

So a fixture's score only moves when the cron fires or a visitor opens that match's
detail page. On the landing page — the highest-traffic public surface — the polled score
sits at the seeded value (the observed `0–0`) between cron runs. The existing
`maybeScheduleMatchSync` already solves exactly this for one match; the landing endpoint
simply never calls it.

## Goals / Non-Goals

**Goals:**
- The landing live section's polled scores advance from the provider without depending on
  the cron cadence or on someone opening a detail page.
- Reuse the established opportunistic-sync mechanism (throttle, `after()` scheduling,
  `runMatchSync`) rather than inventing a parallel path.
- Keep the endpoint fast and the visitor experience unchanged: same payload shape, same
  cadence, no added latency on the poll itself.
- Bound provider load even under many concurrent visitors.

**Non-Goals:**
- No change to the client component, polling interval, markup, or styling.
- No blocking/await-on-sync to make the *current* poll fresher (next poll is soon enough).
- No change to the cron, the per-match route, or the sync engine internals.
- No new provider, schema, migration, or env var.

## Decisions

### Decision: Trigger the sync inside `GET /api/live-matches`, after building the payload

Add the scheduling in the landing endpoint itself, because it is the one code path hit
every ~30s for every landing visitor. After computing `{ live, nextUp }`, iterate the
`live` fixtures and call `maybeScheduleMatchSync({ id, status })` for each, then return
the payload as before.

- **Alternative — trigger in the client:** rejected; it would require a second endpoint or
  a mutation from the browser and duplicate the throttle logic client-side.
- **Alternative — let cron handle it / shorten cron interval:** rejected; cron freshness is
  coarse, competes with rate limits across all matches, and still leaves gaps between runs.

### Decision: Reuse `maybeScheduleMatchSync` and its 15s per-match throttle

`maybeScheduleMatchSync` already: skips `final`/`cancelled`, debounces per match id via a
module-level `Map` (`MATCH_MIN_INTERVAL_MS = 15s`), claims the slot before running, and
schedules `runMatchSync(id)` via `after()` so it executes after the response. Because the
throttle map is shared with the per-match route, landing and detail-page traffic for the
same fixture share one cooldown — concurrent visitors collapse to ~1 provider attempt per
15s per warm instance.

- **Alternative — `maybeScheduleOpportunisticSync(matches)` (5-min, staleness-based):**
  rejected as the primary path; its 5-minute floor is too slow for an actively-live score
  the user is watching tick. The 15s per-match path matches the per-match route's behavior
  and the section's ~30s poll.

### Decision: Schedule only currently-live fixtures, capped per request

Only the `live` array is scheduled — never `nextUp` (a future fixture) and never terminal
fixtures (the helper already excludes those, and `maybeScheduleMatchSync` skips them as a
second guard). Cap the number scheduled per request to a small fixed N (the section itself
shows at most 4 rows) to bound fan-out if an unusually large slate is live at once.

### Decision: Non-blocking — current poll returns the existing snapshot

The endpoint does not `await` the sync. `maybeScheduleMatchSync` uses `after()`, so the
provider round-trip and DB write happen post-response. The visitor sees the updated score
on the *next* ~30s poll, which is within the spec's "updates within roughly one poll
interval" guarantee and keeps the current request latency unchanged.

## Risks / Trade-offs

- **[Provider rate / cost increase from landing traffic]** → The 15s per-match throttle plus
  the per-request cap bound attempts to ~1 per 15s per live fixture per warm instance;
  `runMatchSync` is idempotent and skips terminal matches. Net new load is proportional to
  the number of live fixtures, not visitors.
- **[Per-instance throttle under Fluid Compute scale-out]** → Each instance keeps its own
  `Map`, so N instances can yield up to N attempts per window. Acceptable and unchanged from
  the per-match route's existing behavior; the provider tolerates idempotent reads.
- **[One-poll-interval lag before a fresh score shows]** → Accepted by design; blocking the
  poll on a provider round-trip would slow the highest-traffic public endpoint for everyone.
- **[Sync errors]** → `maybeScheduleMatchSync`/`runMatchSync` already isolate failures (run
  in `after()`); the endpoint keeps its existing try/catch that degrades to an empty payload,
  so a provider outage never breaks the section.

## Migration Plan

Pure additive code change to one route handler; no schema, no migration, no env. Ships with
the deploy and is covered by route tests. Rollback = revert the handler change; the endpoint
returns to read-only behavior with no data cleanup required.

## Open Questions

- None blocking. The per-request cap value (small N, e.g. 6) can be tuned in implementation
  without changing the contract.
