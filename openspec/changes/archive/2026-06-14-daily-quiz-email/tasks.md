## 1. Database

- [x] 1.1 Add migration `supabase/migrations/<ts>_quiz_reminder_log.sql` creating `quiz_reminder_log (user_id uuid references profiles(id) on delete cascade, question_id uuid references quiz_questions(id) on delete cascade, sent_at timestamptz not null default now(), primary key (user_id, question_id))`
- [x] 1.2 Enable RLS on `quiz_reminder_log` with no policies (service-role only), mirroring `result_email_log`
- [x] 1.3 In the same (or a paired) migration, add `profiles.quiz_reminder_opt_out boolean not null default false` and `profiles.unsubscribe_token uuid not null default gen_random_uuid()` with a unique index on `unsubscribe_token`
- [x] 1.4 Regenerate / extend DB types in `lib/db.ts` for the new table and profile columns

## 2. i18n copy

- [x] 2.1 Add a `quizEmail` namespace to `messages/en.json` (subject, heading, intro, streakLine, cta, footer, unsubscribe)
- [x] 2.2 Mirror the `quizEmail` keys in `messages/es.json` with Spanish translations
- [x] 2.3 Mirror the `quizEmail` keys in `messages/fr.json` with French translations

## 3. Pure email renderer

- [x] 3.1 Create `lib/notifications/quiz-reminder-template.ts` with a pure `renderQuizReminderEmail(data)` returning `{ subject, html, text }`, following `result-email-template.ts` (inline hex colors, table layout, `escapeHtml`, plain-text fallback)
- [x] 3.2 Accept `{ strings, displayName, quizUrl, unsubscribeUrl, streak? }`; omit the streak clause when `streak` is absent/0; include the unsubscribe link in the footer
- [x] 3.3 Add a unit test for the renderer (HTML + text structure, quiz link present, streak clause present/absent) — no DB/network

## 4. Dispatcher

- [x] 4.1 Create `lib/notifications/quiz-reminder-emails.ts` exporting `dispatchQuizReminders(fromName?) -> { emailed, skipped, failed }`, env-gated to a zero-summary no-op when `RESEND_API_KEY` is unset (mirror `dispatchResultEmails`)
- [x] 4.2 Resolve today's active question (`quiz_questions` where `active_on = (now() at time zone 'utc')::date`); if none, return zero summary
- [x] 4.3 Compute eligible users via the anti-join: `profiles` LEFT JOIN `quiz_answers` (today's question) LEFT JOIN `quiz_reminder_log` (today's question), `WHERE` both null `AND quiz_reminder_opt_out = false`
- [x] 4.4 Resolve each eligible user's email via `admin.auth.admin.getUserById` (reuse the `resolveEmail` pattern); skip and count users with no/invalid address
- [x] 4.5 Best-effort streak: batch-load eligible users' `quiz_answers.answered_at` and compute `computeStreak` per user; never let a streak error block a send
- [x] 4.6 Render per recipient at `DEFAULT_LOCALE` via `getTranslations({ locale: DEFAULT_LOCALE, namespace: 'quizEmail' })`; build `quizUrl = siteUrl + localePath(DEFAULT_LOCALE, '/quiz')` and a token-based `unsubscribeUrl`
- [x] 4.7 Send via `resend.batch.send` chunked to `RESEND_BATCH_LIMIT` (≤100); set the `List-Unsubscribe` header per message; use `withFromName(env.emailFrom, fromName)` and `getActiveBranding().emailFromName`
- [x] 4.8 After each successful batch, upsert `quiz_reminder_log` rows `(user_id, question_id)` with `onConflict` ignore-duplicates; log `[quiz-reminders] ledger write failed` loudly on ledger error
- [x] 4.9 Log per-recipient failures without aborting the run; return the emailed/skipped/failed summary

## 5. Cron route

- [x] 5.1 Create `app/api/cron/quiz-reminders/route.ts` as a GET handler with `export const maxDuration = 60`, mirroring `app/api/cron/sync-matches/route.ts` Bearer-`CRON_SECRET` auth and 204/401/200 shape
- [x] 5.2 In the handler, call `dispatchQuizReminders(getActiveBranding()?.emailFromName)` inside an isolated try/catch; log failures with a `[cron:quiz-reminders]` prefix and never 500
- [x] 5.3 Return a JSON summary `{ emailed, skipped, failed }`
- [x] 5.4 Add `{ "path": "/api/cron/quiz-reminders", "schedule": "0 13 * * *" }` to `vercel.json` crons

## 6. Unsubscribe

- [x] 6.1 Create `app/api/quiz-reminders/unsubscribe/route.ts` (GET, no auth) that looks up `profiles` by `unsubscribe_token` and sets `quiz_reminder_opt_out = true` (idempotent), returning a simple confirmation response
- [x] 6.2 Handle missing/invalid token gracefully (no enumeration, friendly message, no error)

## 7. Verification

- [x] 7.1 Add dispatcher tests: eligibility (answered/opted-out/already-logged excluded), no-active-question no-op, `RESEND_API_KEY`-unset no-op, ledger written only after success, batch chunking, one-failure-does-not-abort
- [x] 7.2 Add an unsubscribe-route test (valid token opts out; repeat is idempotent; bad token is graceful)
- [x] 7.3 Verify `quizEmail` key parity across en/es/fr (extend the existing i18n parity test if present)
- [x] 7.4 Run `npm run typecheck`, `npm run lint`, and `npm test`; confirm green
- [x] 7.5 Manually invoke the cron route locally with a valid `CRON_SECRET` against a seeded active question and confirm the summary + ledger rows; confirm an unsubscribe link click flips the flag
