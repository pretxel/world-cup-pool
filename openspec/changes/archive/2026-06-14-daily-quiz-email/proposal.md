## Why

The daily quiz is the app's habit loop — one trivia question per UTC day, points,
and a consecutive-day streak. But there is no nudge: a user only answers if they
remember to open `/quiz` that day. Streaks break silently and engagement leaks.
The repo already has the pieces to fix this (Resend dispatch, an idempotent
ledger pattern, a pure email renderer, and Vercel cron), so a once-a-day "today's
quiz is live" reminder is a small, high-leverage addition.

## What Changes

- A new daily cron route (`/api/cron/quiz-reminders`) sends each eligible user one
  email per day reminding them to answer the day's active quiz question, deep
  linking to `/quiz`.
- **Eligible** = the user has not answered today's question, has not already been
  sent today's reminder, and has not opted out. No active question today ⇒ no-op.
- A new `quiz_reminder_log(user_id, question_id)` ledger guarantees at-most-once
  delivery per user per day, mirroring the existing `result_email_log` pattern.
- A new pure email renderer + `quizEmail` message namespace (en/es/fr) for the
  subject/body/CTA/footer. Sent in `DEFAULT_LOCALE` (en), consistent with the
  existing result emails (no per-user email locale exists yet).
- Optional engagement hook: the email surfaces the user's current streak so the
  copy can say "keep your N-day streak alive."
- **Opt-out + unsubscribe**: a `profiles.quiz_reminder_opt_out` flag plus a
  tokenized one-click unsubscribe endpoint, so bulk daily mail stays
  CAN-SPAM/GDPR-clean and protects sender reputation.
- A new `vercel.json` cron entry at a fixed daily UTC time.

## Capabilities

### New Capabilities
- `daily-quiz-email`: a scheduled, once-per-day, at-most-once email reminding each
  opted-in user who has not yet answered the day's quiz to go answer it, with a
  deep link, optional streak hook, and one-click unsubscribe.

### Modified Capabilities
<!-- none — this is additive. The `daily-quiz` and `result-email-notifications`
     specs are deliberately left untouched; the latter has an in-flight
     `admin-force-result-email` change and must not be edited here. -->

## Impact

- **New code**: `app/api/cron/quiz-reminders/route.ts` (cron entry, Bearer auth,
  `maxDuration`), `lib/notifications/quiz-reminder-emails.ts` (dispatcher),
  `lib/notifications/quiz-reminder-template.ts` (pure renderer), and an
  unsubscribe route handler.
- **DB**: new migration adding `quiz_reminder_log` (service-role-only RLS) and
  `profiles.quiz_reminder_opt_out` + `profiles.unsubscribe_token`.
- **Config**: a new `vercel.json` cron entry; reuses existing `RESEND_API_KEY`,
  `EMAIL_FROM`, `CRON_SECRET`, `SITE_URL` env. No new secrets.
- **i18n**: new `quizEmail` namespace in `messages/{en,es,fr}.json`.
- **No changes** to the quiz gameplay, leaderboard, or result-email flows.
