# automated-results

## Purpose

Rules governing the cron-driven match-result sync from an external football data API into `public.matches`. Defines the route handler, its auth model, the env-var gating, the team-name aliasing strategy, the status/score mapping, and the contract for the response summary.

## Requirements

### Requirement: Cron route handler exists at /api/cron/sync-matches

The system SHALL expose a GET route handler at `/api/cron/sync-matches` that, when invoked with a valid `Authorization: Bearer ${CRON_SECRET}` header, fetches the current WC2026 match list from Football-Data.org, mirrors each fixture's status/score into `public.matches`, and calls `compute_match_scores(p_match_id)` for every match it touched. Any other invocation (missing or wrong secret) SHALL receive `401 Unauthorized`.

#### Scenario: Authorized invocation
- **WHEN** a request hits `/api/cron/sync-matches` with `Authorization: Bearer <CRON_SECRET>` matching the env var
- **THEN** the handler runs the sync and returns a 2xx JSON summary describing what changed

#### Scenario: Missing secret
- **WHEN** a request hits the route with no `Authorization` header (or a wrong bearer)
- **THEN** the response status is `401`
- **AND** no database writes occur

### Requirement: Sync is gated by env vars and degrades cleanly

If `FOOTBALL_DATA_TOKEN` or `CRON_SECRET` is missing in the runtime environment, the route handler SHALL short-circuit with `204 No Content` and an `x-skipped: missing-env` header. It SHALL NOT throw or write to the database.

#### Scenario: Missing FOOTBALL_DATA_TOKEN
- **WHEN** the route is invoked with a valid `Authorization` header but `FOOTBALL_DATA_TOKEN` is unset
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

The handler SHALL return a JSON body summarizing the run for log inspection, including counts of matched rows, live transitions, final writes, recompute calls, and unmatched/error rows.

#### Scenario: Summary shape
- **WHEN** the handler completes a normal run
- **THEN** the response body is a JSON object containing the keys `fetched`, `matched`, `live`, `final`, `recomputed`, `unmatched`, and `errors`, each whose value is a non-negative integer
