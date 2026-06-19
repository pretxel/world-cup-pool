# comeback-email Specification

## Purpose
A once-daily re-engagement email to inactive players — those with a past pick but no prediction in the last N days (default 5) who still have a confirmed, still-pickable upcoming match — showing days-since-last-pick, their current rank from `v_leaderboard_overall`, and the next matches to pick. Sent to opted-in recipients via a new cron, rate-limited by a per-recipient cooldown ledger, to reactivate churned users who otherwise receive no message. Mirrors the existing cron + renderer + dispatcher + Resend + i18n + recordRun + one-click-unsubscribe patterns.

## Requirements

### Requirement: Once-daily comeback-email cron
The system SHALL expose a cron route at `app/api/cron/comeback-emails/route.ts` that dispatches a comeback email to inactive players, registered in `vercel.json` `crons` on a single fixed UTC schedule. The route SHALL require `Authorization: Bearer ${CRON_SECRET}` when `CRON_SECRET` is set, MUST return 401 on mismatch, and MAY allow the call in non-production when no secret is set, returning a 204 skip on missing-env in production (mirroring `prediction-reminders/route.ts`). The route SHALL run the dispatch inside `recordRun("comeback_emails", "cron", …)`, MUST isolate dispatch failures (catch, log, respond with a zero summary rather than a 500), and SHALL return the dispatch summary as JSON. The route SHALL set `maxDuration` above the default to allow address resolution and multiple send batches.

#### Scenario: Authorized scheduled run
- **WHEN** the cron invokes the route with a valid `Bearer ${CRON_SECRET}`
- **THEN** the comeback-email dispatch runs
- **AND** exactly one `operation_runs` row is recorded with kind `comeback_emails` and trigger `cron`
- **AND** the response is a JSON summary with `emailed`, `failed`, and `skipped` counts

#### Scenario: Unauthorized request
- **WHEN** the route is called with a missing or incorrect bearer token while `CRON_SECRET` is set
- **THEN** the response is 401 and no email is sent

#### Scenario: Dispatch throws
- **WHEN** the comeback-email dispatch throws during a run
- **THEN** the failure is caught and logged
- **AND** a `comeback_emails` operation run is recorded with status `error`
- **AND** the route responds with a zero summary rather than a 500

### Requirement: Inactive-and-actionable recipient targeting
The dispatcher SHALL target only players who are both inactive and have something to come back to. A player is **inactive** when they have at least one prediction and their most recent `predictions.submitted_at` is older than the inactivity threshold (default 5 days). A player is **actionable** when there is at least one confirmed, still-pickable upcoming match (`isConfirmedMatch` and not `isLocked`, per `lib/match-utils.ts`). The dispatcher MUST exclude any player with zero predictions (never played) and MUST NOT email any player when no pickable upcoming match exists. The dispatcher SHALL page through profiles and predictions so the recipient set is not truncated by the PostgREST page cap, mirroring `prediction-reminder-emails.ts`. The pending-recipient computation SHALL be a pure, exported function for unit testing.

#### Scenario: Inactive player with a pickable match
- **WHEN** a player's most recent prediction is older than the inactivity threshold and at least one confirmed, still-pickable upcoming match exists
- **THEN** the player is included in the comeback recipient set

#### Scenario: Recently active player suppressed
- **WHEN** a player predicted within the inactivity threshold
- **THEN** the player is NOT included in the comeback recipient set

#### Scenario: Never-played account excluded
- **WHEN** an account has no predictions at all
- **THEN** it is NOT included in the comeback recipient set

#### Scenario: No pickable match anywhere
- **WHEN** there is no confirmed, still-pickable upcoming match for the tournament
- **THEN** no comeback email is sent to anyone

### Requirement: Per-recipient cooldown
The system SHALL persist a per-recipient cooldown ledger `comeback_email_log` with a `user_id uuid` (referencing `profiles(id)`, on delete cascade) and a `sent_at timestamptz not null default now()`, indexed on `(user_id, sent_at)`, so a player is not re-nudged within a cooldown window (default 14 days). A player SHALL be eligible only when they have no `comeback_email_log` row whose `sent_at` is newer than the cooldown window. A ledger row SHALL be written only after the email provider accepts the batch containing that recipient, so a failed send stays pending and retries on a later run. The ledger table SHALL have RLS enabled with no policies (service-role access only), matching `prediction_reminder_log`/`result_email_log`. The migration SHALL NOT backfill the ledger, so the first run can reach the existing inactive cohort.

#### Scenario: Within cooldown — suppressed
- **WHEN** the cron runs and a recipient has a `comeback_email_log` row whose `sent_at` is within the cooldown window
- **THEN** no second comeback email is sent to that recipient

#### Scenario: Cooldown elapsed — eligible again
- **WHEN** a recipient's most recent `comeback_email_log.sent_at` is older than the cooldown window and they are still inactive with a pickable match
- **THEN** the recipient is eligible to be nudged again

#### Scenario: Ledger written only on accepted send
- **WHEN** a batch is accepted by the email provider
- **THEN** a `(user_id, sent_at)` row is written for every recipient in that batch
- **AND WHEN** a batch is rejected
- **THEN** no ledger rows are written for it and those recipients stay pending for a later run

### Requirement: Comeback email content
The comeback email SHALL give the recipient a reason to return. It MUST state how many days it has been since their last pick (derived from `predictions.submitted_at`). It MUST show the recipient's **current rank** and total points from `v_leaderboard_overall` when present, and render an "unranked" state when the recipient is absent from the view (picks but no scored match yet). It MUST list the next confirmed, still-pickable upcoming matches. The email SHALL include a single call-to-action deep-linking to `/matches?picks=needed`, built from `env.siteUrl` and `localePath(DEFAULT_LOCALE, "/matches?picks=needed")`, and a footer one-click unsubscribe link.

#### Scenario: Ranked recipient
- **WHEN** a comeback email is rendered for a recipient present in `v_leaderboard_overall`
- **THEN** the email shows the days since their last pick
- **AND** the email shows the recipient's current rank and total points
- **AND** the email lists the next pickable matches
- **AND** the email links to `/matches?picks=needed`

#### Scenario: Unranked recipient
- **WHEN** a comeback email is rendered for a recipient absent from `v_leaderboard_overall`
- **THEN** the email renders an "unranked" state instead of a rank number
- **AND** the email still shows days since last pick, the next pickable matches, and the CTA

### Requirement: Pure, localized comeback renderer
The comeback email SHALL be produced by a pure, dependency-free renderer at `lib/notifications/comeback-email-template.ts` that returns both an HTML part (email-safe table layout with inline styles and fixed hex colors, no `oklch`/`var()`/stylesheets) and a plain-text part, mirroring `prediction-reminder-template.ts`. All user-facing copy SHALL be supplied by the caller (no hardcoded strings in the renderer) and SHALL be resolved from a `comebackEmail` i18n namespace present in `messages/{en,es,fr,de}.json`. The renderer MUST HTML-escape all interpolated copy and data, and MUST return a `{ subject, html, text }` result.

#### Scenario: Renderer emits both parts
- **WHEN** the comeback renderer is called with resolved strings and data
- **THEN** it returns a `{ subject, html, text }` result
- **AND** the HTML uses inline styles with fixed hex colors and no stylesheet/`var()`/`oklch`

#### Scenario: Copy comes from i18n
- **WHEN** the dispatcher builds comeback copy
- **THEN** all strings are resolved via `getTranslations({ locale: DEFAULT_LOCALE, namespace: "comebackEmail" })`
- **AND** the `comebackEmail` namespace exists in `messages/en.json`, `messages/es.json`, `messages/fr.json`, and `messages/de.json`

### Requirement: Honor email preferences and one-click unsubscribe
The comeback email SHALL honor a new `comeback` per-type preference in `profiles.email_prefs`, added to `EMAIL_PREF_KEYS`, `DEFAULT_EMAIL_PREFS` (default opted-IN), `emailPrefsSchema`, and `normalizeEmailPrefs` in `lib/email-prefs.ts`, and to the `profiles.email_prefs` jsonb default via migration. Before send, the dispatcher SHALL drop any recipient whose `comeback` preference is explicitly `false`, using the existing `isOptedIn` semantics; a recipient with no row, a missing key, a null column, or a non-boolean value SHALL be treated as opted-in. The system SHALL add a one-click unsubscribe route at `app/api/comeback-emails/unsubscribe/route.ts` (GET and RFC 8058 one-click POST) that, given a valid `unsubscribe_token`, sets only the `comeback` key to `false` in that profile's `email_prefs`, idempotently and without enumerating whether the token matched. The email SHALL carry `List-Unsubscribe`/`List-Unsubscribe-Post` headers pointing at this route.

#### Scenario: Opted-out recipient dropped
- **WHEN** a player's `email_prefs.comeback` is explicitly `false`
- **THEN** they are not sent a comeback email

#### Scenario: Default opted-in
- **WHEN** a player has no `comeback` key (or a null/malformed `email_prefs`)
- **THEN** they are treated as opted-in and eligible to receive the comeback email

#### Scenario: One-click unsubscribe
- **WHEN** a recipient follows the footer unsubscribe link (GET) or a mail client posts the one-click request with a valid `unsubscribe_token`
- **THEN** that profile's `email_prefs.comeback` is set to `false`
- **AND** no other email preference is changed
- **AND** the response is the same confirmation regardless of whether the token matched

### Requirement: Best-effort, env-gated delivery
The dispatcher SHALL be best-effort and idempotent: it MUST no-op (log and return a zero summary) when `env.resendApiKey` is unset, MUST send in batches of at most 100 via `resend.batch.send`, and MUST treat each batch as all-or-nothing. The dispatcher MUST resolve each recipient's email from `auth.users` via the service-role admin client and MUST skip recipients with no resolvable address, counting them as `skipped` rather than `failed`. Per-recipient/per-batch failures SHALL be logged and counted in the summary without aborting the rest. The dispatcher SHALL call `checkEmailSenderConfig` and warn when the production sender is misconfigured (sandbox default and/or missing key) without changing the resolved sender, carrying that signal on the summary.

#### Scenario: RESEND_API_KEY unset
- **WHEN** `env.resendApiKey` is unset
- **THEN** the dispatcher logs and returns a zero summary without sending, and writes no ledger rows

#### Scenario: Unresolvable address skipped
- **WHEN** a recipient has no resolvable email
- **THEN** they are counted as `skipped` and no send is attempted for them

#### Scenario: Misconfigured production sender
- **WHEN** the production sender resolves to the sandbox default or the key is missing
- **THEN** the run emits a single warning and carries the misconfiguration flag on its summary
- **AND** the resolved sender is unchanged

### Requirement: Run recording
The system SHALL add `comeback_emails` to `OperationKind` and `OPERATION_KINDS` in `lib/operations/record-run.ts`, and a matching entry to `OPERATION_SCHEDULES` in `lib/operations/schedule.ts`, so the comeback run appears in the operations control room. Each cron run SHALL be recorded exactly once via `recordRun`, with status derived from the summary's `failed` count (`success` when zero, `partial` when non-zero, `error` when the dispatch throws).

#### Scenario: Successful run recorded
- **WHEN** a comeback run completes with `failed` equal to 0
- **THEN** an `operation_runs` row is recorded with kind `comeback_emails` and status `success`

#### Scenario: Partial run recorded
- **WHEN** a comeback run completes with a non-zero `failed` count
- **THEN** the recorded `operation_runs` row has status `partial`
