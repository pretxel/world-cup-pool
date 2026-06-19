## Purpose

Provide a once-daily results digest email that summarizes the day for opted-in players — the leaderboard top 5, the recipient's own rank and day-over-day rank delta, and the day's biggest movers. It is a proactive, time-triggered retention touchpoint (análisis.md bet M7) that reaches players who did not open the app that day, built on the existing cron + renderer + dispatcher + Resend + i18n + recordRun patterns with no new third-party dependency.

## Requirements

### Requirement: Once-daily results digest cron
The system SHALL expose a cron route at `app/api/cron/results-digest/route.ts` that dispatches a daily results digest, registered in `vercel.json` `crons` on a single fixed UTC schedule that runs after `sync-matches` so the prior day's finals are scored first. The route SHALL require `Authorization: Bearer ${CRON_SECRET}` when `CRON_SECRET` is set, MUST return 401 on mismatch, and MAY allow the call in non-production when no secret is set (mirroring `prediction-reminders/route.ts`). The route SHALL run the dispatch inside `recordRun("results_digest", "cron", …)`, MUST isolate dispatch failures (catch, log, respond with a zero summary rather than a 500), and SHALL return the dispatch summary as JSON. The route SHALL set `maxDuration` above the default to allow address resolution and multiple send batches.

#### Scenario: Authorized scheduled run
- **WHEN** the cron invokes the route with a valid `Bearer ${CRON_SECRET}`
- **THEN** the digest dispatch runs
- **AND** exactly one `operation_runs` row is recorded with kind `results_digest` and trigger `cron`
- **AND** the response is a JSON summary with `emailed`, `failed`, and `skipped` counts

#### Scenario: Unauthorized request
- **WHEN** the route is called with a missing or incorrect bearer token while `CRON_SECRET` is set
- **THEN** the response is 401 and no email is sent

#### Scenario: Dispatch throws
- **WHEN** the digest dispatch throws during a run
- **THEN** the failure is caught and logged
- **AND** a `results_digest` operation run is recorded with status `error`
- **AND** the route responds with a zero summary rather than a 500

### Requirement: Digest content
The digest email SHALL summarize the day with three parts. It MUST include the leaderboard **top 5** from `v_leaderboard_overall` (rank, display name, total points). It MUST include the recipient's **own current rank** and total points, and — when a previous-day baseline exists — their **day-over-day rank delta**. It MUST include the day's **biggest movers** (the largest rank gains and/or drops) when a previous-day baseline exists. The email SHALL include a single call-to-action deep-linking to `/leaderboard`, built from `env.siteUrl` and `localePath(DEFAULT_LOCALE, "/leaderboard")`.

#### Scenario: Digest with a baseline
- **WHEN** a digest is rendered for a recipient on a day that has a previous-day rank snapshot
- **THEN** the email shows the leaderboard top 5
- **AND** the email shows the recipient's own rank, total points, and rank delta versus the previous day
- **AND** the email shows the day's biggest movers
- **AND** the email links to `/leaderboard`

#### Scenario: First run without a baseline
- **WHEN** a digest is rendered and no previous-day rank snapshot exists yet
- **THEN** the email still shows the top 5 and the recipient's own rank
- **AND** the rank-delta and biggest-movers sections are omitted

### Requirement: Pure, localized digest renderer
The digest SHALL be produced by a pure, dependency-free renderer at `lib/notifications/results-digest-template.ts` that returns both an HTML part (email-safe table layout with inline styles and fixed hex colors, no `oklch`/`var()`/stylesheets) and a plain-text part, mirroring `result-email-template.ts`. All user-facing copy SHALL be supplied by the caller (no hardcoded strings in the renderer) and SHALL be resolved from a `resultsDigest` i18n namespace present in `messages/{en,es,fr,de}.json`. The renderer MUST HTML-escape all interpolated copy and data.

#### Scenario: Renderer emits both parts
- **WHEN** the digest renderer is called with resolved strings and data
- **THEN** it returns a `{ subject, html, text }` result
- **AND** the HTML uses inline styles with fixed hex colors and no stylesheet/`var()`/`oklch`

#### Scenario: Copy comes from i18n
- **WHEN** the dispatcher builds digest copy
- **THEN** all strings are resolved via `getTranslations({ locale: DEFAULT_LOCALE, namespace: "resultsDigest" })`
- **AND** the `resultsDigest` namespace exists in `messages/en.json`, `messages/es.json`, `messages/fr.json`, and `messages/de.json`

### Requirement: Per-day, per-recipient dedupe
The system SHALL persist a per-day, per-recipient dedupe ledger `results_digest_log` with primary key `(digest_date, user_id)` so that each opted-in player receives at most one digest per day. A ledger row SHALL be written only after the email provider accepts the batch containing that recipient, so a failed send stays pending and retries on a later run that same day. A re-run of the cron on the same day MUST NOT re-send to recipients who already have a ledger row for that day. The ledger table SHALL have RLS enabled with no policies (service-role access only), matching `result_email_log`. The migration SHALL backfill the current day's ledger for all players so the first deploy does not send a digest for a day already in progress.

#### Scenario: Already sent today
- **WHEN** the cron runs and a recipient already has a `results_digest_log` row for today's date
- **THEN** no second digest is sent to that recipient

#### Scenario: Ledger written only on accepted send
- **WHEN** a batch is accepted by the email provider
- **THEN** a `(digest_date, user_id)` row is written for every recipient in that batch
- **AND WHEN** a batch is rejected
- **THEN** no ledger rows are written for it and those recipients stay pending for a later run that day

#### Scenario: Backfill on deploy
- **WHEN** the dedupe-ledger migration is applied
- **THEN** the current day is pre-marked as sent for all players so the next cron does not blast a same-day digest

### Requirement: Per-day rank snapshot for deltas and movers
The system SHALL persist a per-day rank snapshot `leaderboard_rank_daily` with primary key `(snapshot_date, user_id)` and a `rank` column, used as the baseline for day-over-day rank deltas and the biggest-movers section. Before computing movers and sending, the dispatcher SHALL upsert today's snapshot from `v_leaderboard_overall`. Day-over-day delta SHALL be computed as the difference between today's rank and the most recent prior snapshot's rank. The snapshot table SHALL have RLS enabled with no policies (service-role access only). When no prior snapshot exists, deltas and movers SHALL be omitted from that day's digest.

#### Scenario: Snapshot upserted each run
- **WHEN** the dispatcher runs for a day
- **THEN** today's rank for each player in `v_leaderboard_overall` is upserted into `leaderboard_rank_daily` keyed by `(snapshot_date, user_id)`

#### Scenario: Delta computed from prior snapshot
- **WHEN** a prior-day snapshot exists for a recipient
- **THEN** the recipient's rank delta is today's rank minus the prior snapshot's rank
- **AND** a player who climbed shows an improved (lower-number) rank delta

### Requirement: Honor email preferences
The digest SHALL honor a new `results_digest` per-type preference in `profiles.email_prefs`, added to `EMAIL_PREF_KEYS`, `DEFAULT_EMAIL_PREFS` (default opted-IN), `emailPrefsSchema`, and `normalizeEmailPrefs` in `lib/email-prefs.ts`, and to the `profiles.email_prefs` jsonb default via migration. Before send, the dispatcher SHALL drop any recipient whose `results_digest` preference is explicitly `false`, using the existing `isOptedIn` semantics. A recipient with no row, a missing key, a null column, or a non-boolean value SHALL be treated as opted-in.

#### Scenario: Opted-out recipient dropped
- **WHEN** a player's `email_prefs.results_digest` is explicitly `false`
- **THEN** they are not sent a digest

#### Scenario: Default opted-in
- **WHEN** a player has no `results_digest` key (or a null/malformed `email_prefs`)
- **THEN** they are treated as opted-in and eligible to receive the digest

### Requirement: Eligible-recipient targeting
The digest SHALL target only active players — those present in `v_leaderboard_overall` (players with at least one scored prediction; admins are already excluded by the view) — and SHALL NOT email accounts that have never played. The dispatcher MUST resolve each recipient's email from `auth.users` via the service-role admin client and MUST skip recipients with no resolvable or undeliverable address (reusing `isSendableEmail` from `result-emails.ts`), counting them as `skipped` rather than `failed`.

#### Scenario: Never-played account excluded
- **WHEN** an account has no row in `v_leaderboard_overall`
- **THEN** it is not included in the digest recipient set

#### Scenario: Undeliverable address skipped
- **WHEN** a recipient has no resolvable email or an address that fails `isSendableEmail`
- **THEN** they are counted as `skipped` and no send is attempted for them

### Requirement: Best-effort, env-gated delivery
The dispatcher SHALL be best-effort and idempotent: it MUST no-op (log and return a zero summary) when `env.resendApiKey` is unset, MUST send in batches of at most 100 via `resend.batch.send`, and MUST treat each batch as all-or-nothing. Per-recipient/per-batch failures SHALL be logged and counted in the summary without aborting the rest. The dispatcher SHALL call `checkEmailSenderConfig` and warn when the production sender is misconfigured (sandbox default and/or missing key) without changing the resolved sender, carrying that signal on the summary.

#### Scenario: RESEND_API_KEY unset
- **WHEN** `env.resendApiKey` is unset
- **THEN** the dispatcher logs and returns a zero summary without sending, and writes no ledger rows

#### Scenario: Misconfigured production sender
- **WHEN** the production sender resolves to the sandbox default or the key is missing
- **THEN** the run emits a single warning and carries the misconfiguration flag on its summary
- **AND** the resolved sender is unchanged

### Requirement: Run recording
The system SHALL add `results_digest` to `OperationKind` and `OPERATION_KINDS` in `lib/operations/record-run.ts` so the digest run appears in the operations control room. Each cron run SHALL be recorded exactly once via `recordRun`, with status derived from the summary's `failed` count (`success` when zero, `partial` when non-zero, `error` when the dispatch throws).

#### Scenario: Successful run recorded
- **WHEN** a digest run completes with `failed` equal to 0
- **THEN** an `operation_runs` row is recorded with kind `results_digest` and status `success`

#### Scenario: Partial run recorded
- **WHEN** a digest run completes with a non-zero `failed` count
- **THEN** the recorded `operation_runs` row has status `partial`
