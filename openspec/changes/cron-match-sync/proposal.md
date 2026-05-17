## Why

Today every match result has to be typed into `/admin/matches` by hand. As soon as the tournament starts that becomes a 64-match babysitting job — match ends, admin checks the score somewhere, types it in, hopes nobody's predictions get stale until they do. The pool already has a working recompute path (DB trigger + `setMatchResult` action), so the missing piece is an automated upstream that hands the admin's job to a scheduled function. Free public APIs cover the World Cup; we just need to call one on a timer.

## What Changes

- New scheduled function at `app/api/cron/sync-matches/route.ts` that:
  1. Fetches WC2026 fixtures from [Football-Data.org](https://www.football-data.org/) (`GET /v4/competitions/WC/matches?season=2026`).
  2. Matches each remote fixture to a local `public.matches` row by team-name pair + kickoff-date proximity.
  3. For matches whose remote status is `IN_PLAY` or `PAUSED`, sets local `status='live'`.
  4. For matches whose remote status is `FINISHED`, sets local `home_score`, `away_score`, and `status='final'`.
  5. Calls `compute_match_scores(p_match_id)` for every match touched (idempotent — also handles drift).
  6. Returns a JSON summary `{ fetched, matched, live, final, recomputed }`.
- New `lib/team-name-aliases.ts` mapping remote team names to local seed names (e.g. `"USA" → "United States"`, `"Korea Republic" → "South Korea"`). Anything unmatched is logged and ignored — never crashes the run.
- Cron registration in `vercel.json` (new file) with schedule `*/10 * * * *`. **Pre-condition:** the Vercel project must be on the Pro plan for minute-level crons; on Hobby the schedule has to drop to daily. This is doc'd in the proposal but enforced by Vercel itself — no code change needed if the plan limits us.
- Auth: the route handler checks `Authorization: Bearer ${CRON_SECRET}` and rejects anything else with `401`. Vercel auto-attaches this header on cron invocations.
- New env vars: `FOOTBALL_DATA_TOKEN` (the API token) and `CRON_SECRET` (random string used to authenticate cron invocations). Documented in `lib/env.ts`.
- Existing `forceRecompute` admin action stays as a manual escape hatch.

## Capabilities

### New Capabilities
- `automated-results`: rules governing the cron-driven match-result sync — schedule, data source, matching strategy, idempotency, and the recompute step.

### Modified Capabilities
- `match-results`: the existing `setMatchResult` server action stays unchanged, but the spec now acknowledges that the same write path can be exercised by the cron in addition to the admin UI.

## Impact

- Code: `app/api/cron/sync-matches/route.ts` (new), `lib/team-name-aliases.ts` (new), `lib/env.ts` (extend with the two new env vars), `vercel.json` (new — for the cron schedule).
- Env: `FOOTBALL_DATA_TOKEN` and `CRON_SECRET` must be added to Vercel (Production + Preview) before the first cron fires. Without them the route returns `204 No Content` with a clear `x-skipped` header so the cron doesn't error.
- DB: no schema changes. Writes go through `public.matches` + `compute_match_scores`, both already in place.
- Tests: unit test for the team-name normalizer + a route-handler smoke test that mocks `fetch` and asserts the right update statements are issued for each remote status (`IN_PLAY`, `FINISHED`, others).
- Rate limit: 10 req/min on Football-Data.org free tier. One cron run = 1 fetch. Safe.
- Observability: each run logs a one-line summary; failures throw so they surface in Vercel function logs.
- No DB migration. No new runtime dep — `fetch` is built in.
