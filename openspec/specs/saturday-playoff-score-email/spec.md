## Purpose

Provide a weekly, Saturday-scheduled digest that emails every opted-in player the final scorelines of that Saturday's finished knockout-stage (playoff) matches. The knockout rounds are the peak-engagement moment of the tournament and, with stage-weighted scoring, a single playoff result can swing the standings, so a once-a-week scoreline email is a high-value, low-friction retention touchpoint that reaches players who did not open the app. It reuses the established email plumbing — pure localized renderer, dispatcher, Resend batch send, `isOptedIn` gating, `recordRun` instrumentation, and the production email-sender guard — with no new third-party dependency, and adds a per-Saturday, per-recipient dedupe ledger so a re-run never double-sends.

## Requirements

### Requirement: Saturday-only playoff-score digest cron

The system SHALL expose a cron route at `app/api/cron/playoff-score-saturday/route.ts` that dispatches a playoff-score digest, registered in `vercel.json` `crons` on a single fixed **Saturday** UTC schedule that runs after `sync-matches` so that day's playoff finals are scored first. The route SHALL require `Authorization: Bearer ${CRON_SECRET}` when `CRON_SECRET` is set, MUST return 401 on mismatch, and MAY allow the call in non-production when no secret is set (mirroring `results-digest/route.ts`). The route SHALL run the dispatch inside `recordRun("playoff_score_email", "cron", …)`, MUST isolate dispatch failures (catch, log, respond with a zero summary rather than a 500), SHALL set `maxDuration` above the default to allow address resolution and multiple send batches, and SHALL return the dispatch summary as JSON.

#### Scenario: Authorized scheduled run
- **WHEN** the cron invokes the route with a valid `Bearer ${CRON_SECRET}`
- **THEN** the playoff-score dispatch runs
- **AND** exactly one `operation_runs` row is recorded with kind `playoff_score_email` and trigger `cron`
- **AND** the response is a JSON summary with `emailed`, `failed`, and `skipped` counts

#### Scenario: Unauthorized request
- **WHEN** the route is called with a missing or incorrect bearer token while `CRON_SECRET` is set
- **THEN** the response is 401 and no email is sent

#### Scenario: Dispatch throws
- **WHEN** the dispatch throws during a run
- **THEN** the failure is caught and logged
- **AND** a `playoff_score_email` operation run is recorded with status `error`
- **AND** the route responds with a zero summary rather than a 500

### Requirement: Selection of the Saturday's finished playoff matches

The dispatcher SHALL select, for the active competition, every match that is `status = 'final'`, has a knockout stage (any `matches.stage` value other than `group`), and kicked off within the target Saturday computed in the competition's reference timezone. Group-stage matches and non-`final` matches SHALL be excluded. When the target Saturday contains no such match, the dispatcher SHALL send no email, write no ledger rows, and return a zero summary.

#### Scenario: Knockout finals on Saturday are selected
- **WHEN** the active competition has two `r16` matches with `status = 'final'` that kicked off on the target Saturday
- **THEN** both matches are included in the digest content

#### Scenario: Group-stage and non-final matches are excluded
- **WHEN** the target Saturday also has a `group` match that is `final` and an `r16` match that is still `live`
- **THEN** neither the group match nor the live knockout match is included

#### Scenario: Empty playoff Saturday sends nothing
- **WHEN** the target Saturday has no finished knockout matches for the active competition
- **THEN** no email is sent
- **AND** no `playoff_score_email_log` rows are written
- **AND** the run returns a zero summary

### Requirement: Recipients are all opted-in players

The dispatcher SHALL resolve recipients as every player with a usable email address who is opted in per `isOptedIn`, regardless of whether they predicted any of the selected matches. Players who are not opted in or have no usable address SHALL NOT be emailed.

#### Scenario: Opted-in non-predictor is a recipient
- **WHEN** a player is opted in and has a usable address but predicted none of the Saturday's playoff matches
- **THEN** that player is a recipient

#### Scenario: Opted-out player is excluded
- **WHEN** a player has opted out of emails
- **THEN** that player is not emailed even if knockout matches finished that Saturday

### Requirement: Scoreline-only localized renderer

The digest SHALL be produced by a pure, dependency-free renderer at `lib/notifications/playoff-score-template.ts` that returns `{ subject, html, text }`, mirroring `results-digest-template.ts`. For each selected match the email SHALL show the two team names and the final scoreline, and MAY show a knockout decider note (e.g. after extra time / penalties) when present in the data. The email SHALL NOT include per-player points, hit type, rank, rank delta, biggest movers, or bracket-progression sections. The HTML part SHALL use an email-safe table layout with inline styles and fixed hex colors (no `oklch`, no `var()`, no stylesheets) and MUST HTML-escape all interpolated copy and data; a plain-text part SHALL also be returned. All user-facing copy SHALL be supplied by the caller and resolved from a `playoffScoreEmail` i18n namespace present in `messages/{en,es,fr,de}.json`. The email SHALL include a single call-to-action deep-linking to `/bracket`, built from `env.siteUrl` and `localePath(DEFAULT_LOCALE, "/bracket")`.

#### Scenario: Renderer emits both parts with scorelines only
- **WHEN** the renderer is called with resolved strings and two finished matches
- **THEN** it returns a `{ subject, html, text }` result showing each match's team names and final scoreline
- **AND** the HTML uses inline styles with fixed hex colors and no stylesheet/`var()`/`oklch`
- **AND** no points, rank, or bracket-progression section is present

#### Scenario: Decider note rendered when present
- **WHEN** a selected match carries a knockout decider note (e.g. won on penalties)
- **THEN** the email shows the scoreline together with that note

#### Scenario: Copy comes from i18n
- **WHEN** the dispatcher builds the email copy
- **THEN** all strings are resolved via `getTranslations({ locale: DEFAULT_LOCALE, namespace: "playoffScoreEmail" })`
- **AND** the `playoffScoreEmail` namespace exists in `messages/en.json`, `messages/es.json`, `messages/fr.json`, and `messages/de.json`

### Requirement: Per-Saturday, per-recipient dedupe ledger

The system SHALL persist a per-day, per-recipient dedupe ledger `playoff_score_email_log` with primary key `(digest_date, user_id)` so each opted-in player receives at most one playoff-score email per Saturday. A ledger row SHALL be written only after the email provider accepts the batch containing that recipient, so a failed send stays pending and retries on a later run that same day. A re-run of the cron on the same Saturday MUST NOT re-send to recipients who already have a ledger row for that date. The ledger table SHALL have RLS enabled with no policies (service-role access only), matching `result_email_log` and `results_digest_log`. The creation migration SHALL backfill the current day's ledger for all players so the first deploy does not send for a Saturday already in progress.

#### Scenario: Already sent today
- **WHEN** the cron runs and a recipient already has a `playoff_score_email_log` row for the target Saturday's date
- **THEN** no second email is sent to that recipient

#### Scenario: Failed send stays pending
- **WHEN** the email provider rejects the batch containing a recipient
- **THEN** no ledger row is written for that recipient
- **AND** the recipient is retried on a later run that same Saturday

#### Scenario: Backfill prevents retroactive send
- **WHEN** the creation migration runs on a Saturday already in progress
- **THEN** a `playoff_score_email_log` row exists for every player for the current date
- **AND** the first dispatch after deploy sends nobody an email for that day

#### Scenario: Service-role-only access
- **WHEN** a non-service-role client queries `playoff_score_email_log`
- **THEN** RLS returns no rows because the table has no policies
