## Why

The retention engine today is almost entirely reactive: a player only hears from us when *they* did something that triggered an email — a per-match `result` email when a standing changed (`lib/notifications/result-emails.ts`), a `prediction_reminder` before a match they can still pick, a `quiz_reminder`. A player who simply did not open the app on a day with matches gets nothing summarizing what happened. análisis.md flags this as medium bet **M7**: a once-daily *results digest* — the day's top 5, the recipient's own rank, and the biggest movers — is a daily touchpoint that pulls back users who did not open the app that day. The infrastructure to build it already exists end-to-end: the cron pattern (`app/api/cron/*` + `vercel.json`), the renderer/sender/Resend/i18n pattern (`result-emails.ts`, `result-email-template.ts`), the standings source (`v_leaderboard_overall`), the per-type opt-out (`profiles.email_prefs`), and the run-recording seam (`lib/operations/record-run.ts`). So this is a medium-effort/high-impact addition with no new third-party dependency.

## What Changes

- Add a new once-daily cron route `app/api/cron/results-digest/route.ts` (registered in `vercel.json`) that dispatches a "yesterday's results" digest, following the exact shape of `app/api/cron/prediction-reminders/route.ts` (Bearer `CRON_SECRET` auth, `maxDuration`, isolated dispatch wrapped in `recordRun`, JSON summary response).
- Add a server-only dispatcher `lib/notifications/results-digest-emails.ts` mirroring `result-emails.ts`: gate on `env.resendApiKey`, compute the digest day's data, drop opted-out recipients, resolve each recipient's email via the admin client, render localized copy, batch-send (≤100/batch) via Resend, and stamp a dedupe ledger only for batches the provider accepted.
- The digest body, shared across all recipients for a given day, is: the **top 5** of `v_leaderboard_overall` (rank, display name, total points) and the **biggest movers** of the day (largest rank gain/drop) — both derived from a per-day rank snapshot. Each recipient additionally gets **their own rank** (and their day-over-day rank delta) inlined.
- Add a pure, dependency-free renderer `lib/notifications/results-digest-template.ts` following `result-email-template.ts`: email-safe table HTML with a fixed hex palette, an HTML + plain-text part, all copy supplied by the caller, deep-linking to `/leaderboard`.
- Add a per-day, per-recipient dedupe ledger `results_digest_log (digest_date date, user_id uuid)` (Supabase migration) so a re-run of the cron on the same day never re-sends — the at-most-once posture of `result_email_log`, keyed by day instead of match.
- Add a per-day rank snapshot so "your rank delta" and "biggest movers" have a previous-day baseline: a `leaderboard_rank_daily (snapshot_date date, user_id uuid, rank int)` table (Supabase migration) written by the same cron before computing movers.
- Honor `profiles.email_prefs`: add a new `results_digest` preference key (default opted-IN, `!== false` semantics) reusing `lib/email-prefs.ts` `isOptedIn`, and drop opted-out recipients before send.
- Add a new `results_digest` operation kind to `lib/operations/record-run.ts` so the run shows up in the operations control room with the same `success`/`partial`/`error` classification.
- Add a `resultsDigest` i18n namespace to `messages/{en,es,fr,de}.json`.
- No-op silently when `RESEND_API_KEY` is unset (mirrors every existing dispatcher).

Non-goals: per-timezone send segmentation (that is M6), a recap/comic digest (that is M9), a comeback email to inactive users (that is M11), an in-app feed of the digest, push notifications, or any change to how scores/standings are computed.

## Capabilities

### New Capabilities
- `daily-results-digest-email`: a once-daily email summarizing the day — the leaderboard top 5, the recipient's own rank and day-over-day delta, and the day's biggest movers — sent to opted-in players via a new cron, deduped per day, to pull back users who did not open the app.

### Modified Capabilities

## Impact

- **App**: new `app/api/cron/results-digest/route.ts` (cron handler, modeled on `prediction-reminders/route.ts`). New entry in `vercel.json` `crons`.
- **Lib**: new `lib/notifications/results-digest-emails.ts` (server-only dispatcher) and `lib/notifications/results-digest-template.ts` (pure renderer). Reuses `lib/env` `emailFrom`/`resendApiKey`/`siteUrl`, `lib/supabase/admin`, `lib/i18n` `DEFAULT_LOCALE`/`localePath`, `getTranslations`, `isSendableEmail` + the `resolveEmail` pattern from `result-emails.ts`, and `email-sender-config.ts` `checkEmailSenderConfig`.
- **Operations**: add `results_digest` to `OperationKind`/`OPERATION_KINDS` in `lib/operations/record-run.ts`; the cron records each run via `recordRun("results_digest", "cron", …)`.
- **i18n**: new `resultsDigest` namespace in `messages/{en,es,fr,de}.json`.
- **Data**: two new service-role-only tables (Supabase migrations) — `results_digest_log` (per-day dedupe ledger, keyed `(digest_date, user_id)`) and `leaderboard_rank_daily` (per-day rank baseline, keyed `(snapshot_date, user_id)`) — plus a new `results_digest` key in the `profiles.email_prefs` jsonb default and in `lib/email-prefs.ts` (`EMAIL_PREF_KEYS`, `DEFAULT_EMAIL_PREFS`, `emailPrefsSchema`, `normalizeEmailPrefs`). RLS enabled with no policies on both new tables (service-role only), matching `result_email_log`. The digest ledger is backfilled for "today" so the first deploy does not blast a digest for a day already in progress.
- **Dependency / caveat**: deliverability depends on `EMAIL_FROM` being a Resend verified-domain sender in production (`lib/env.ts:46` otherwise falls back to the sandbox `World Cup Pools <onboarding@resend.dev>`, which only reaches the account owner) — análisis.md quick win **QW1**, already noted as a prerequisite for every email feature. With `RESEND_API_KEY` unset the dispatch no-ops.
