## Why

Players lose points when they forget to predict a fixture before it kicks off — and a locked match can never be picked again. The app already nudges players to answer the daily quiz by email, but nothing reminds them about the higher-stakes action: submitting score predictions for matches happening **today**. A daily reminder closes that gap and protects players' standings.

## What Changes

- Add a daily cron that emails each opted-in player a reminder listing **today's** still-open matches they have **not** yet predicted, with a CTA to go make their picks.
- Reminders cover only **confirmed** fixtures (real teams, not knockout placeholders) that are still **open** (scheduled and not past kickoff) at send time; players who have already predicted every such match are skipped.
- Idempotent per player per day: a player receives at most one prediction reminder for a given day, even across cron retries, via a new ledger table.
- Independent opt-out: a new `prediction_reminder_opt_out` flag and a one-click unsubscribe link (reusing each profile's existing `unsubscribe_token`), separate from the quiz-reminder opt-out.
- New localized email template (en/es/fr) that lists today's pending fixtures, mirroring the existing quiz/result email visual language.

## Capabilities

### New Capabilities
- `prediction-reminder-email`: Daily email that reminds opted-in players about today's matches they still need to predict, with per-day idempotency and one-click unsubscribe.

### Modified Capabilities
<!-- None. This is additive: new cron route, template, ledger table, opt-out column, and unsubscribe route. Existing prediction/lock behavior is unchanged. -->

## Impact

- **Cron config**: new entry in `vercel.json` (`/api/cron/prediction-reminders`).
- **Routes**: new `app/api/cron/prediction-reminders/route.ts` and `app/api/prediction-reminders/unsubscribe/route.ts`.
- **Lib**: new `lib/notifications/prediction-reminder-emails.ts` (dispatcher) and `lib/notifications/prediction-reminder-template.ts` (renderer); reuses Resend, `env`, admin Supabase client, and `getActiveBranding()`.
- **Database**: new `prediction_reminder_log` table; new `profiles.prediction_reminder_opt_out` column (Supabase migration + regenerated `lib/database.types.ts`).
- **i18n**: new `predictionEmail` namespace in `messages/{en,es,fr}.json`.
- **Existing systems**: depends on the `sync-matches` cron keeping `matches` fresh; no change to prediction submission or lock rules.
