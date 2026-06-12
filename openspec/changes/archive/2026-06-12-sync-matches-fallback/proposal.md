# Proposal: sync-matches-fallback

## Why

The match-result sync (`/api/cron/sync-matches`) depends on a single external source (Football-Data.org) and a single daily Vercel cron tick. Every failure mode is silent: an upstream 4xx/5xx throws and the run is lost until the next day, an empty/stale payload looks like a successful run, and if the cron never fires nothing detects it. During the World Cup, a missed run means scores and leaderboards are wrong for up to 24 hours with no signal to anyone.

## What Changes

- Extract the sync core (match loading, remote→local matching, status/score mapping, recompute) out of the route handler into a reusable `lib/` module so it can be driven by the cron route, a fallback path, and an admin action.
- Introduce a **result-source abstraction**: providers that each fetch WC2026 results and normalize them to the existing `RemoteMatch` shape. Football-Data.org stays primary; add one secondary provider used only when the primary fails or returns no usable data.
- Add **staleness detection**: a check that flags matches whose `kickoff_at` is older than a threshold (~3h) but are still not `final`. Stale matches trigger a sync attempt that may escalate to the fallback source — this catches cron-not-firing and silently-bad payloads, not just HTTP errors.
- Expand the run summary so the response and logs say which source served the run and whether stale matches were detected/resolved.
- Add an **admin "sync now" action** on `/admin/matches` that invokes the same sync core on demand, as a human-triggered fallback when scores look wrong.

No breaking changes. Existing cron auth model (`Bearer ${CRON_SECRET}`), env gating, and the never-downgrade-a-final rule are preserved.

## Capabilities

### New Capabilities

(none — all changes extend existing capabilities)

### Modified Capabilities

- `automated-results`: sync gains a source-abstraction with a secondary fallback provider, staleness detection that drives fallback escalation, and an extended run summary reporting source used and staleness counts.
- `admin-fixture-editing`: `/admin/matches` gains a "sync now" control that runs the shared sync core on demand and surfaces the run summary to the admin.

## Impact

- **Code**: `app/api/cron/sync-matches/route.ts` shrinks to auth + delegation; new `lib/result-sync/` module (sync core, provider interface, Football-Data provider, fallback provider, staleness check); `app/[locale]/(admin)/admin/matches/` gains a sync-now action + button.
- **APIs / external**: one new outbound dependency on the fallback results API (provider choice in design.md; preference for a keyless/free source).
- **Env**: possibly one new env var if the chosen fallback source requires a key; absent vars must degrade with the existing `204 x-skipped: missing-env` pattern.
- **DB**: no schema changes. Same `matches` updates and `compute_match_scores` RPC.
- **Tests**: `tests/sync-matches.test.ts` refactors against the extracted core; new tests for provider fallback ordering, staleness detection, and normalization of the secondary source.
