# Design: sync-matches-fallback

## Context

`app/api/cron/sync-matches/route.ts` is a single ~175-line GET handler: auth → env gate → fetch Football-Data.org → match remote rows to `public.matches` by `(home_team|away_team|UTC date)` → write status/score → `compute_match_scores` RPC. It is invoked once daily by a Vercel cron (`vercel.json`, `0 9 * * *`, Hobby plan).

Failure modes today are all silent: upstream non-OK throws and the run is lost for 24h; an empty or stale payload produces a healthy-looking summary; a cron that never fires produces nothing at all. The only human fallback is manual score entry via `setMatchResult` on `/admin/matches`.

Constraints:

- Hobby plan: daily cron only; no schedule change in this change.
- No DB schema changes (per proposal).
- Existing behavior must be preserved exactly: auth model, `204 x-skipped: missing-env` gating, alias-based matching, never-downgrade-a-final, idempotent recompute.
- This repo's Next.js version has breaking changes vs training data — consult `node_modules/next/dist/docs/` before route/server-action work.

## Goals / Non-Goals

**Goals:**

- Survive a Football-Data.org outage or bad payload by escalating to a secondary source within the same run.
- Detect "results should exist but don't" (staleness) regardless of why — bad payload, unmatched names, or a cron tick that never happened.
- Give admins a one-click on-demand sync and visibility into staleness.
- Make the sync core reusable and unit-testable outside the route handler.

**Non-Goals:**

- Changing the cron schedule or moving off Vercel cron.
- Alerting/notification channels (email, Telegram) — admin UI visibility only.
- Live minute-by-minute scores; this remains a results/leaderboard correctness mechanism.
- Persisting sync-run history (would require schema changes).

## Decisions

### D1: Extract sync core into `lib/result-sync/`

```
lib/result-sync/
  types.ts        RemoteMatch (moved from route), RunSummary, ResultProvider
  core.ts         runSync(providers, opts): load locals → match → write → recompute
  staleness.ts    findStaleMatches(locals, now): kickoff_at < now - 3h && status != 'final'
  providers/
    football-data.ts   primary (existing fetch, unchanged semantics)
    espn.ts            fallback (normalizes ESPN scoreboard JSON → RemoteMatch)
```

The route handler keeps only auth + env gating + delegation. The admin server action calls `runSync` directly (no HTTP hop). Rationale: one tested code path for three triggers (cron, opportunistic, admin); alternative of duplicating fetch logic in an admin action was rejected as drift-prone.

### D2: Provider abstraction with ordered escalation

```ts
interface ResultProvider {
  name: string;                                   // "football-data" | "espn"
  available(): boolean;                           // env present?
  fetchMatches(dates?: string[]): Promise<RemoteMatch[]>;
}
```

Escalation rules inside `runSync`:

1. Try primary. Hard failure (non-OK, network throw) or zero matches → run fully from fallback.
2. After applying any source's data, run the staleness check. If stale matches remain **and** the source used was primary → targeted fallback fetch for the stale matches' dates, apply, re-count.

```
primary ──ok──▶ apply ──▶ stale remain? ──yes──▶ fallback(stale dates) ──▶ apply
   │                          │ no
  fail                        ▼
   │                        done
   ▼
fallback (full) ──▶ apply ──▶ done
```

One attempt per provider per run — the fallback *is* the retry. In-run retries with backoff were rejected: the opportunistic trigger (D4) and tomorrow's cron already provide temporal retries, and serverless invocations should stay short.

`source` in the summary means "whose data was applied": a fallback fetch that succeeds with zero matches leaves `source: "none"`, and a targeted escalation only flips `source` to the fallback when it actually wrote something.

Fallback fetches are bounded: per-day sources fetch at most the newest 14 candidate days (`MAX_FALLBACK_DATES`), so a "full" fallback run after a multi-week outage is the newest two weeks, logged when the cap bites — never silently truncated.

Finals are immutable to every feed: once a row is `final`, neither provider may change its score — the admin result form is the only correction path (it intentionally bypasses this rule). An identical final payload skips the redundant UPDATE but still calls `compute_match_scores`, healing a run whose write succeeded but whose RPC failed (the idempotent re-run contract from the base spec). Both sync UPDATEs also carry a DB-level `.neq("status", "final")` guard so a concurrent admin edit made after the run's snapshot was loaded can't be clobbered.

### D3: Fallback source = ESPN unofficial scoreboard API

`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD` — keyless, free, returns events with teams, status, and full-time scores; normalized in `providers/espn.ts` to `RemoteMatch` (reusing `normalizeTeamName` aliases; ESPN names like "USA" already route through the alias table).

| Option | Key | Cost | Risk |
|---|---|---|---|
| ESPN unofficial (chosen) | none | free | unofficial, shape may change |
| TheSportsDB | free key | free tier limits | weaker live/score fidelity |
| API-Football | key | 100 req/day free | another secret to manage |

Rationale: zero new env vars and zero cost; it is a *fallback*, so its unofficial status is acceptable — a fallback failure degrades to today's behavior, never worse. Normalization is isolated in one provider file so a shape change is a one-file fix.

Verified live during implementation (resolves Q1): slug `fifa.world` serves real WC2026 data; `?dates=` accepts both single days and `YYYYMMDD-YYYYMMDD` ranges. One trap found and handled: **ESPN buckets days by US Eastern time, not UTC** — a 01:00Z kickoff on June 13 is served by `dates=20260612`. The provider therefore fetches one range widened a day back (`min(date)-1 .. max(date)`); surplus events match by their own UTC date or land in `unmatched`.

### D4: Staleness drives detection — three trigger paths

`findStaleMatches`: status not terminal (`final`/`cancelled` — a cancelled match intentionally has no result) AND `kickoff_at < now - 3h` AND both teams resolve to real countries (placeholder knockout fixtures excluded). 3h covers 90' + ET + penalties + buffer.

Trigger paths for the sync core:

1. **Cron** (existing) — daily tick, now with escalation per D2.
2. **Opportunistic** — when the public matches page server-renders and the already-loaded match list contains a stale match, schedule a non-blocking `runSync` after the response (Next.js `after()`; verify exact API in `node_modules/next/dist/docs/`). Debounced by a module-level last-attempt timestamp (≥5 min between attempts per instance). This is the only automatic path that catches cron-not-firing.
3. **Admin "sync now"** — server action on `/admin/matches`, runs `runSync`, revalidates, displays the summary. Page also shows a stale badge per match (computed at render; no schema needed).

True self-monitoring of Vercel cron was rejected: a watchdog cron shares the same infrastructure failure domain, and run-history persistence is out of scope. Opportunistic + human covers the gap proportionally to how much anyone is looking at the product — which is exactly when correctness matters.

### D5: Extended run summary

Existing keys unchanged (`fetched, matched, live, final, recomputed, unmatched, errors`); add:

- `source`: `"football-data" | "espn" | "none"` — which provider's data was applied (fallback name if escalation ran)
- `stale`: count of stale matches detected at end of run
- `staleResolved`: stale matches resolved during this run

`unmatched` stays warn-only but now visibly accompanies `source` in logs, making alias gaps diagnosable per provider.

## Risks / Trade-offs

- [ESPN shape/slug changes without notice] → isolated in `providers/espn.ts`; provider failure degrades to current single-source behavior; normalization covered by fixture-based unit tests.
- [Conflicting concurrent runs (cron + opportunistic + admin)] → writes are idempotent and never downgrade a final; recompute RPC is idempotent; worst case is duplicate work, not corruption. Per-instance debounce caps opportunistic frequency.
- [Per-instance in-memory debounce is weak on serverless] → accepted: Fluid Compute reuses instances, and even a worst-case stampede is a handful of cheap idempotent runs; football-data free tier (10 req/min) tolerates it because opportunistic runs only fire when stale matches exist.
- [Two sources disagree on a score] → finals are immutable to all feeds; whichever source finalizes first wins, and corrections are an explicit admin action. A wrong first write therefore persists until an admin fixes it — accepted, because silent feed-driven rewrites of settled pool points are worse.
- [Opportunistic trigger adds latency to matches page] → work is scheduled after the response is sent; page render only pays for the staleness scan over already-loaded rows (O(n), in memory).
- [Team-name aliases tuned for Football-Data may miss ESPN variants] → unmatched counts surface per-source in summary; alias table extension is a known, cheap follow-up.

## Migration Plan

1. Extract core to `lib/result-sync/` with behavior-preserving refactor; existing `tests/sync-matches.test.ts` keeps passing against the core.
2. Add ESPN provider + escalation + staleness (new tests).
3. Wire opportunistic trigger + admin sync-now.
4. Deploy. Rollback = revert; no schema, no env, no contract changes (summary is additive).

## Open Questions

- ~~Q1: Exact ESPN competition slug/date filtering for WC2026~~ — resolved, see D3 (slug verified, Eastern-day bucketing handled with a widened range).
- Q2: Should opportunistic trigger also run on the leaderboard page (second-most-viewed surface)? Default: matches page only; trivially extendable.
