# Tasks: sync-matches-fallback

## 1. Verify fallback source & extract sync core

- [x] 1.1 Verify ESPN scoreboard endpoint for WC2026 (competition slug, `?dates=YYYYMMDD` filtering, status/score field shapes); capture a real JSON sample as a test fixture (resolves design Q1)
- [x] 1.2 Create `lib/result-sync/types.ts`: move `RemoteMatch`, `LocalMatch`, extend `Summary` → `RunSummary` with `source`, `stale`, `staleResolved`
- [x] 1.3 Create `lib/result-sync/core.ts`: extract load-locals / match-by-key / status-score writes / recompute loop from `app/api/cron/sync-matches/route.ts` into `runSync()`, behavior-preserving
- [x] 1.4 Create `lib/result-sync/providers/football-data.ts`: existing fetch as `ResultProvider` (`available()` checks `FOOTBALL_DATA_TOKEN`)
- [x] 1.5 Refactor route handler to auth + env gate + `runSync()` delegation; keep `401` / `204 x-skipped: missing-env` semantics per spec
- [x] 1.6 Update `tests/sync-matches.test.ts` to target the extracted core; all existing tests pass unchanged in behavior

## 2. Fallback provider & escalation

- [x] 2.1 Implement `lib/result-sync/providers/espn.ts`: fetch + normalize to `RemoteMatch` (statuses → FINISHED/IN_PLAY equivalents, team names through `normalizeTeamName`), keyless `available()`
- [x] 2.2 Implement escalation in `runSync`: primary hard-fail or zero matches → full fallback run; record `source` in summary
- [x] 2.3 Implement post-apply stale-escalation: stale matches remain after primary → targeted fallback fetch for stale dates → re-apply → re-count
- [x] 2.4 Guarantee cross-source no-downgrade: provider order never overwrites an existing `final` (test both directions)
- [x] 2.5 Tests: primary 5xx → fallback used; primary empty → fallback used; both fail → `source: "none"`, no writes; ESPN fixture normalization; targeted-date fallback scoping

## 3. Staleness detection

- [x] 3.1 Implement `lib/result-sync/staleness.ts`: `findStaleMatches(locals, now)` — `kickoff_at < now - 3h`, `status != 'final'`, both teams real (reuse existing country/placeholder resolution)
- [x] 3.2 Run staleness check at end of every `runSync`; populate `stale` / `staleResolved` in summary
- [x] 3.3 Tests: overdue scheduled/live flagged; placeholder fixtures excluded; <3h excluded; `staleResolved` counts matches fixed within the run

## 4. Opportunistic trigger (public matches page)

- [x] 4.1 Check `node_modules/next/dist/docs/` for the post-response scheduling API (`after()` or current equivalent) and server-component constraints
- [x] 4.2 Add staleness scan over the already-loaded match list in the matches page server render; if stale, schedule `runSync` post-response with module-level 5-min debounce
- [x] 4.3 Tests: stale → run scheduled; non-stale → not scheduled; second render within 5 min → suppressed

## 5. Admin sync-now & stale badges

- [x] 5.1 Add `syncNow` server action in `app/[locale]/(admin)/admin/matches/actions.ts` calling `runSync` directly; revalidate matches paths
- [x] 5.2 Add "Sync now" button to `/admin/matches` rendering the returned summary (source, matched, final, stale, errors), including visible failure state (`source: "none"`)
- [x] 5.3 Add per-row stale indicator on `/admin/matches` using `findStaleMatches` at render
- [x] 5.4 i18n: add EN/ES/FR strings for sync-now button, summary labels, stale badge (project has active i18n change — follow existing message-catalog pattern)

## 6. Verification

- [x] 6.1 Full test suite green; run cron route locally against real providers (or recorded fixtures) and confirm summary shape matches spec (`source`, `stale`, `staleResolved` present)
- [x] 6.2 Confirm `vercel.json` untouched and existing cron behavior unchanged (auth, 204 gating, idempotent re-run)
