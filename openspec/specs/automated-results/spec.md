# automated-results

## Purpose

Rules governing the cron-driven match-result sync from an external football data API into `public.matches`. Defines the route handler, its auth model, the env-var gating, the team-name aliasing strategy, the status/score mapping, and the contract for the response summary.
## Requirements
### Requirement: Cron route handler exists at /api/cron/sync-matches

The system SHALL expose a GET route handler at `/api/cron/sync-matches` that, when invoked with a valid `Authorization: Bearer ${CRON_SECRET}` header, runs the shared sync core: fetch the current WC2026 match list through the ordered provider chain (Football-Data.org primary, fallback on escalation), mirror each fixture's status/score into `public.matches`, and call `compute_match_scores(p_match_id)` for every match it touched. Any other invocation (missing or wrong secret) SHALL receive `401 Unauthorized`.

#### Scenario: Authorized invocation
- **WHEN** a request hits `/api/cron/sync-matches` with `Authorization: Bearer <CRON_SECRET>` matching the env var
- **THEN** the handler runs the sync and returns a 2xx JSON summary describing what changed

#### Scenario: Missing secret
- **WHEN** a request hits the route with no `Authorization` header (or a wrong bearer)
- **THEN** the response status is `401`
- **AND** no database writes occur

### Requirement: Sync is gated by env vars and degrades cleanly

If `CRON_SECRET` is missing in a production runtime, the route handler SHALL short-circuit with `204 No Content` and an `x-skipped: missing-env` header; in non-production environments a missing `CRON_SECRET` SHALL allow the request through unauthenticated (local development convenience). If `FOOTBALL_DATA_TOKEN` is missing, the primary provider SHALL be skipped and the run SHALL proceed with the remaining available providers; if no provider is available, the handler SHALL short-circuit with `204 No Content` and `x-skipped: missing-env`. It SHALL NOT throw or write to the database in any short-circuit case.

#### Scenario: Missing FOOTBALL_DATA_TOKEN
- **WHEN** the route is invoked with a valid `Authorization` header but `FOOTBALL_DATA_TOKEN` is unset
- **THEN** the run skips the primary provider and proceeds with the keyless fallback provider
- **AND** no Football-Data.org HTTP request is made

#### Scenario: No provider available
- **WHEN** the route is invoked with a valid `Authorization` header and no result provider is available
- **THEN** the handler returns `204` with header `x-skipped: missing-env`
- **AND** no upstream HTTP request is made

### Requirement: Vercel cron schedule wired in vercel.json

The repository SHALL include a `vercel.json` declaring one cron entry pointing at `/api/cron/sync-matches`. The schedule SHALL be a valid cron expression accepted by the project's Vercel plan (e.g. `0 9 * * *` daily for Hobby; `*/10 * * * *` once the project moves to Pro).

#### Scenario: vercel.json contains the cron
- **WHEN** the file `vercel.json` at the repo root is parsed
- **THEN** its `crons` array contains exactly one entry with `path === "/api/cron/sync-matches"`
- **AND** the entry's `schedule` is a valid cron expression

### Requirement: Remote → local matching uses team-name aliases + same UTC date

For each match returned by Football-Data, the system SHALL find the matching local row in `public.matches` using `(home_team, away_team)` pairs after applying a team-name alias table, plus same-UTC-date matching against `kickoff_at`. Unmatched remote rows SHALL be logged and skipped — they SHALL NOT cause the run to fail.

#### Scenario: Direct name match
- **WHEN** a remote row has `homeTeam.name = "Mexico"`, `awayTeam.name = "South Africa"`, `utcDate = "2026-06-11T19:00:00Z"`
- **AND** a local row has the same teams and a `kickoff_at` whose date portion is `2026-06-11`
- **THEN** the cron treats them as the same match

#### Scenario: Aliased name match
- **WHEN** a remote row has `homeTeam.name = "USA"` and the alias table maps `"USA" → "United States"`
- **AND** a local row exists for `"United States"` on the same UTC date
- **THEN** the cron treats them as the same match

#### Scenario: Unmatched remote row
- **WHEN** a remote row's team-pair has no local match after alias lookup
- **THEN** the cron logs the unmatched pair and continues with the rest of the run

### Requirement: Status + score mapping is idempotent and never regresses a final

For each matched row, the cron SHALL apply this mapping:
- Remote `FINISHED` / `AWARDED` with non-null full-time scores → write `home_score`, `away_score`, `status='final'`.
- Remote `IN_PLAY` / `PAUSED` AND local status not already `'final'` → write `status='live'`.
- Remote `SCHEDULED` / `TIMED` / other → no write.

The sync SHALL never downgrade a match that is already locally `'final'` back to `'live'` or `'scheduled'`.

#### Scenario: Finalize a match
- **WHEN** the remote match's status is `FINISHED` with `score.fullTime = { home: 2, away: 1 }`
- **THEN** the local row is updated to `home_score=2, away_score=1, status='final'`
- **AND** `compute_match_scores(local_id)` is invoked

#### Scenario: Flip to live
- **WHEN** the remote match's status is `IN_PLAY` and the local match's current status is `'scheduled'`
- **THEN** the local row is updated to `status='live'`

#### Scenario: Don't downgrade a final
- **WHEN** the remote match's status is `IN_PLAY` and the local match's current status is `'final'`
- **THEN** the local row is NOT modified

#### Scenario: Idempotent re-run
- **WHEN** the cron runs a second time within minutes of a first run with no remote changes
- **THEN** no UPDATE statements are issued for already-correct rows
- **AND** `compute_match_scores` is still called for any row whose values came from the first run, ensuring `public.scores` stays consistent

### Requirement: Run returns a JSON summary

The handler SHALL return a JSON body summarizing the run for log inspection, including counts of matched rows, live transitions, final writes, recompute calls, and unmatched/error rows, plus which provider's data was applied and staleness counts.

#### Scenario: Summary shape
- **WHEN** the handler completes a normal run
- **THEN** the response body is a JSON object containing the keys `fetched`, `matched`, `live`, `final`, `recomputed`, `unmatched`, and `errors`, each whose value is a non-negative integer
- **AND** the key `source` whose value is one of `"football-data"`, `"espn"`, `"none"`
- **AND** the keys `stale` and `staleResolved`, each a non-negative integer

### Requirement: Result sync uses ordered providers with fallback escalation

The sync core SHALL obtain remote results through an ordered list of result providers — Football-Data.org as primary, a secondary keyless provider (ESPN scoreboard) as fallback — each normalizing its payload to the shared `RemoteMatch` shape before the matching pipeline runs. The fallback SHALL be consulted when (a) the primary fetch hard-fails (non-OK response or network error), (b) the primary returns zero matches, or (c) after applying primary data, stale matches remain. In case (c), the fallback fetch SHALL be scoped to the stale matches' dates. A provider whose required env vars are absent SHALL be skipped without error.

#### Scenario: Primary hard failure escalates to fallback
- **WHEN** the primary provider's fetch returns a non-OK status during a sync run
- **THEN** the run fetches results from the fallback provider instead of failing
- **AND** the run summary reports the fallback as the source used

#### Scenario: Empty primary payload escalates to fallback
- **WHEN** the primary provider responds OK but with zero matches
- **THEN** the run fetches results from the fallback provider

#### Scenario: Stale matches after primary trigger targeted fallback
- **WHEN** primary data is applied successfully but at least one stale match remains non-final
- **THEN** the run fetches results from the fallback provider for the stale matches' dates
- **AND** applies any resolutions through the same matching and write pipeline

#### Scenario: Fallback also fails
- **WHEN** both primary and fallback providers fail in a single run
- **THEN** the run completes with a summary whose `source` is `"none"` and `errors` reflects the failures
- **AND** no partial or corrupt writes occur

#### Scenario: Cross-source final is never overwritten
- **WHEN** a match was written `status='final'` from one provider
- **AND** a later run served by the other provider reports a different score or a non-final status for that match
- **THEN** the local row keeps its final status and score

### Requirement: Staleness detection flags overdue non-final matches

The sync core SHALL provide a staleness check that flags any match whose `kickoff_at` is more than 3 hours in the past, whose status is not terminal (`'final'` and `'cancelled'` are excluded — a cancelled match intentionally has no result), and whose both teams resolve to real countries (placeholder fixtures excluded). The check SHALL run at the end of every sync run, and its counts SHALL be reported in the run summary.

#### Scenario: Overdue match is flagged stale
- **WHEN** a confirmed match kicked off 4 hours ago and is still `status='scheduled'` or `'live'`
- **THEN** the staleness check includes it in the stale set

#### Scenario: Placeholder fixture is not stale
- **WHEN** a knockout fixture with placeholder participants (e.g. "2nd Group A") has a past `kickoff_at`
- **THEN** the staleness check excludes it

#### Scenario: Recently kicked-off match is not stale
- **WHEN** a match kicked off 1 hour ago and is `status='live'`
- **THEN** the staleness check excludes it

#### Scenario: Cancelled match is not stale
- **WHEN** a match with a past `kickoff_at` has `status='cancelled'`
- **THEN** the staleness check excludes it

### Requirement: Opportunistic sync trigger from the public matches page

When the public matches page server-renders and the loaded match list contains at least one stale match, the system SHALL schedule a sync run after the response is sent, without blocking or delaying the page render. Opportunistic runs SHALL be debounced so that a given server instance attempts at most one run per 5 minutes.

#### Scenario: Stale match triggers background sync
- **WHEN** the matches page renders and a stale match is present
- **AND** no opportunistic run was attempted by this instance in the last 5 minutes
- **THEN** a sync run is scheduled after the response completes

#### Scenario: No stale matches, no trigger
- **WHEN** the matches page renders and no match is stale
- **THEN** no sync run is scheduled

#### Scenario: Debounce suppresses repeat triggers
- **WHEN** the matches page renders with a stale match twice within 5 minutes on the same instance
- **THEN** only the first render schedules a sync run

### Requirement: Cron run dispatches result-standing emails after recomputing scores

After `runSync()` completes, the `/api/cron/sync-matches` route handler SHALL invoke result-email dispatch, which sends a standing-snapshot email to each player who had a prediction scored on a match that newly reached `final`, as defined by the `result-email-notifications` capability. Dispatch SHALL run only when result providers were available and the sync proceeded (not on a `204` short-circuit). The route's JSON summary MAY include an `emailed` count of messages sent in the run.

#### Scenario: Emails dispatched after a finalization run
- **WHEN** the cron run finalizes one or more matches and recomputes their scores
- **THEN** result-email dispatch runs after the sync
- **AND** affected players receive their standing-snapshot email

#### Scenario: No dispatch on env short-circuit
- **WHEN** the route short-circuits with `204 x-skipped: missing-env`
- **THEN** no email dispatch occurs

### Requirement: Email failures never fail or block the sync

The email dispatch step SHALL be isolated so that any error it raises is caught and logged, and the cron SHALL still return its sync summary. Per-recipient send errors SHALL be logged and counted without aborting the run or the remaining recipients. Email work SHALL NOT alter, delay, or roll back any score or match write performed by the sync.

#### Scenario: Dispatch throws
- **WHEN** result-email dispatch raises an error
- **THEN** the error is caught and logged
- **AND** the route still returns the sync summary with a 2xx status

#### Scenario: One recipient's send fails
- **WHEN** sending to one recipient fails but others succeed
- **THEN** the failure is logged and the successful recipients are still sent
- **AND** the failed recipient remains pending for the next run

### Requirement: Result sync scopes to the active competition

Result sync SHALL resolve the active competition, load only its matches, and use a competition-scoped dedupe key so that fixtures from different competitions cannot collide on shared dates/teams.

#### Scenario: Sync loads only active-competition matches

- **WHEN** `runSync()` executes
- **THEN** it queries matches filtered by the active `competition_id`
- **AND** the dedupe key is scoped per competition

#### Scenario: Cron and manual sync need no new parameters

- **WHEN** the cron route or admin `syncNow` triggers a sync without specifying a competition
- **THEN** the sync defaults to the active competition

### Requirement: Provider URLs derive from competition config

The result providers (football-data, ESPN) SHALL build their request URLs from the active competition's `providers` JSONB rather than hardcoded World Cup endpoints. `ResultProvider.fetchMatches` SHALL accept a provider-config argument.

#### Scenario: World Cup provider URLs unchanged

- **WHEN** sync runs for `world-cup-2026`
- **THEN** the football-data and ESPN URLs resolve to the same endpoints used before the refactor

#### Scenario: Provider URL from competition config

- **WHEN** a competition supplies a different football-data code/season and ESPN league path
- **THEN** the providers build their URLs from those values

