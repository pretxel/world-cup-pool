## 1. Schedule opportunistic sync from the landing live endpoint

- [x] 1.1 In `app/api/live-matches/route.ts`, import `maybeScheduleMatchSync` from `@/lib/result-sync/opportunistic`; after computing `data = await getLiveAndNextUp(...)` and before returning, schedule a sync for each currently-live fixture
- [x] 1.2 Iterate only `data.live` (never `data.nextUp`), cap to a small fixed N (e.g. `LANDING_SYNC_CAP = 6`), and call `maybeScheduleMatchSync({ id: f.id, status: f.status })` per fixture; rely on the helper's own `final`/`cancelled` skip + 15s per-match throttle for de-duplication
- [x] 1.3 Keep the response non-blocking and unchanged: do not `await` the sync (it self-schedules via `after()`), return the same `{ live, nextUp }` payload with `Cache-Control: no-store`, and keep the existing try/catch so a sync/provider failure still degrades to the empty payload
- [x] 1.4 Add a short comment explaining why the read endpoint now schedules syncs (landing is the only ~30s path that otherwise never refreshes scores)

## 2. Tests

- [x] 2.1 In `tests/live-matches.test.ts` (or a sibling route test mirroring `tests/opportunistic-sync.test.ts`), mock `@/lib/result-sync/opportunistic` and assert that polling the route schedules `maybeScheduleMatchSync` once per currently-live fixture with `{ id, status }`
- [x] 2.2 Assert the next-up fallback fixture and any `final`/`cancelled` fixture are NOT scheduled, and that the per-request cap bounds the number of scheduled fixtures
- [x] 2.3 Assert the endpoint stays non-blocking and resilient: the JSON payload is returned even when the scheduler throws, and the response shape/headers are unchanged

## 3. Verification

- [x] 3.1 Run `npm run lint`, `npm run typecheck`, and `npm run test` and confirm green (including the new route assertions and existing `opportunistic-sync` / `live-matches` suites)
- [x] 3.2 Validate the change: `openspec validate sync-landing-live-scores --strict`
