## Context

The app already has:
- `public.matches` with `home_team`, `away_team`, `kickoff_at`, `home_score`, `away_score`, `status`.
- A DB trigger `trg_recompute_scores_on_match_change` that fires `compute_match_scores(match_id)` whenever those columns change.
- A `setMatchResult` server action used by the admin UI that calls `compute_match_scores` unconditionally after every UPDATE, so even no-op saves recompute.

We're adding a third write path — a Vercel cron — that produces the same effect as the admin clicking "Save result" but does it for every fixture every 10 minutes. The DB-side recompute machinery is unchanged.

Football-Data.org provides a free tier (no card required) covering the FIFA World Cup. The endpoint we'll hit:

```
GET https://api.football-data.org/v4/competitions/WC/matches?season=2026
X-Auth-Token: <FOOTBALL_DATA_TOKEN>
```

Returns a JSON envelope with a `matches: []` array. Each match has `homeTeam.name`, `awayTeam.name`, `utcDate`, `status` (`SCHEDULED`/`TIMED`/`IN_PLAY`/`PAUSED`/`FINISHED`/`POSTPONED`/`SUSPENDED`/`CANCELLED`/`AWARDED`), `score.fullTime.{home,away}`.

Vercel Cron Jobs run by Vercel calling the route handler with an `Authorization: Bearer ${CRON_SECRET}` header. Schedules are declared in `vercel.json` or `vercel.ts`. Hobby plan limits cron frequency to once per day; Pro allows minute-level.

## Goals / Non-Goals

**Goals:**
- Live match results land in the DB within ~10 minutes of the final whistle without human intervention.
- Live match *status* (so the UI shows the "Live" badge while a match is in progress) flips within ~10 minutes of kickoff.
- Idempotent: running the cron twice in a row produces no diff and no spurious recomputes that change `public.scores`.
- Safe to ship before `FOOTBALL_DATA_TOKEN` is provisioned. Missing env returns `204` with a header, never crashes.
- The cron run is fast (single API request, batch updates, in/out under a few seconds) so it fits comfortably under the default 300s function timeout.

**Non-Goals:**
- No second cron for "during match days only" cleverness. One cron, always-on. Match-day-aware scheduling can be a follow-up.
- No reconciliation of fixture *additions* (new matches, schedule changes from FIFA). Admin still owns the fixture list. Cron only writes results into existing rows.
- No retries with backoff. If a run fails Vercel records it and the next scheduled run (10 min later) tries again.
- No webhook from Football-Data.org. Pull only.
- No multi-competition support. WC2026 is hardcoded.

## Decisions

**1. Single competition endpoint per run.**

The Football-Data.org `v4/competitions/WC/matches` endpoint returns *all* matches at once. We don't paginate, don't fetch per-match. One HTTP request per cron run keeps us comfortably under the 10 req/min limit and means a single network failure is the only failure mode.

**2. Matching strategy: team-pair + same UTC date.**

We can't trust an integer ID match between Football-Data and our seeded matches. We use the natural key:

```ts
sameMatch = remoteHome === localHome
          && remoteAway === localAway
          && remoteUtcDate.slice(0,10) === localKickoff.slice(0,10);
```

Team names go through the alias map first (e.g. `"USA"` → `"United States"`, `"Korea Republic"` → `"South Korea"`). Unmatched remote rows are logged and skipped — never erroring.

Why same-date instead of same-instant: minor schedule shifts (kickoff time tweaks) would otherwise unmatch the row. The date is stable.

**3. Status mapping.**

| Football-Data status | Our local status |
|---|---|
| `SCHEDULED`, `TIMED` | (no change — DB row's existing scheduled state) |
| `IN_PLAY`, `PAUSED` | `live` |
| `FINISHED` | `final` (and write the score) |
| `POSTPONED`, `SUSPENDED`, `CANCELLED` | (no change for now — admin handles these manually) |
| `AWARDED` | `final` with score (rare; treat same as FINISHED) |

Anything else logs as "unknown" and is skipped.

**4. Update strategy.**

For each matched row:
- If remote status is `FINISHED`/`AWARDED` and we have non-null fullTime scores → UPDATE `home_score`, `away_score`, `status='final'`.
- If remote status is `IN_PLAY`/`PAUSED` AND local `status` is not already `'live'` and not `'final'` → UPDATE `status='live'`.
- After the UPDATE batch, call `compute_match_scores(p_match_id)` once per touched match. This catches the case where the column-diff trigger already fired (because we did change something) AND the case where the row didn't change but we still want a recompute (drift recovery).

We use Supabase's service-role admin client (same pattern as `setMatchResult`) so all writes succeed even though RLS would otherwise block.

**5. Auth.**

```
const auth = request.headers.get("authorization");
if (auth !== `Bearer ${env.cronSecret}`) return new Response("unauthorized", { status: 401 });
```

Vercel injects this header on cron invocations. If someone hits the URL directly without the secret, they get 401. We also accept the lack of `CRON_SECRET` env var only in development (i.e., when `process.env.NODE_ENV !== "production"`) so local testing works without the secret.

**6. Cron schedule + Vercel plan.**

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/sync-matches", "schedule": "*/10 * * * *" }
  ]
}
```

Vercel Hobby plans cap cron frequency at daily. The first deploy with this config on Hobby will reject the cron and surface an error in the dashboard. We document this in the proposal; if the project stays on Hobby we'll drop the schedule to `0 * * * *` (hourly) or `0 6 * * *` (daily).

**7. Failure surfaces.**

- Missing env vars: return 204 with `x-skipped: missing-env` header. Doesn't bubble as an error.
- Football-Data fetch fails: throw — surfaces in Vercel function logs and shows as a failed cron run.
- Supabase update fails on a single row: log + continue (don't let one bad row sink the whole run). At end of run, return 207-style summary including the per-row error count.
- Unmatched remote row: log only.

**8. Why not bypass the trigger entirely?**

The DB trigger is the truth for column-diff recomputes from any write path. We don't want the cron to bypass it. We're already covered: setting `status='final'` + scores will fire the trigger; the explicit `compute_match_scores` call afterward is defense-in-depth.

## Risks / Trade-offs

- **Risk**: Football-Data team names drift from our seed naming → matches go unmatched silently. → **Mitigation**: every unmatched remote row is logged with both names; alias map is one-line additions. Add a unit test for known WC2026 teams so the alias map stays comprehensive.
- **Risk**: cron writes during admin's manual save = race. → **Mitigation**: both writes are idempotent (UPDATE same row, same values). Worst case: two recomputes back-to-back. No data corruption.
- **Risk**: Football-Data outage. → **Mitigation**: 10-min cadence means a 20-min outage costs at most one missed update. Admin can always manually save in the meantime.
- **Risk**: env vars not set in prod → cron stays silent forever. → **Mitigation**: `x-skipped: missing-env` header is grep-able in Vercel logs; can wire up a Vercel alert later. Doc'd as the first manual verify step.
- **Risk**: Hobby plan rejects `*/10`. → **Mitigation**: doc'd as a pre-condition. The PR includes the most useful cadence; downgrading to daily is one config-file line if needed.

## Migration Plan

1. Add `FOOTBALL_DATA_TOKEN` + `CRON_SECRET` to Vercel project env (Production + Preview). Both are plain strings; no secret manager integration needed.
2. Ship the code in this PR. First cron fire will skip with `x-skipped: missing-env` until the env vars land.
3. Confirm in Vercel dashboard that the cron is registered + schedule shows `*/10 * * * *`.
4. Trigger a manual run (`vercel logs` shows next firing; or hit the URL with `Bearer ${CRON_SECRET}` from curl) to confirm round-trip.

Rollback: revert the PR. Cron drops from `vercel.json`. The env vars can stay (unused).

## Open Questions

- Should the cron's per-row error count make the route handler return 207 (Multi-Status) instead of 200? Currently it returns 200 with `errors: N` in the JSON. 207 is more semantically correct but Vercel dashboards may treat anything 2xx-non-200 as success-with-side-effect. Deferring.
