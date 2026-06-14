## 1. Database & types

- [x] 1.1 Add Supabase migration: create `prediction_reminder_log (user_id uuid references profiles(id), reminder_date date, sent_at timestamptz not null default now())` with PK `(user_id, reminder_date)`.
- [x] 1.2 In the same migration, add `profiles.prediction_reminder_opt_out boolean not null default false`.
- [x] 1.3 Add RLS consistent with `quiz_reminder_log`/`profiles` (service-role writes; no public read of the ledger).
- [x] 1.4 Apply the migration and regenerate `lib/database.types.ts`; confirm the new table/column appear.

## 2. Email template (pure renderer)

- [x] 2.1 Create `lib/notifications/prediction-reminder-template.ts` mirroring `quiz-reminder-template.ts` (email-safe table HTML, inline hex colors, header/body/CTA/footer).
- [x] 2.2 Define `PredictionReminderEmailStrings` (subject, preheader, eyebrow, heading, headingNoName, intro, ctaLabel, footer, unsubscribeLabel) and a `matches: { home, away, kickoffLabel }[]` data field; render the fixture list and a CTA button.
- [x] 2.3 Implement the plain-text part mirroring the HTML, listing each fixture and the CTA/unsubscribe URLs.
- [x] 2.4 Export `renderPredictionReminderEmail(data)` returning `{ subject, html, text }`.

## 3. Dispatcher

- [x] 3.1 Create `lib/notifications/prediction-reminder-emails.ts` with `dispatchPredictionReminders(fromName?)` returning `DispatchSummary` and a zero no-op when `RESEND_API_KEY` is unset.
- [x] 3.2 Compute today's UTC date window and load today's matches; filter to confirmed (`isConfirmedMatch`) and open (`!isLocked`) fixtures. Return zero if none.
- [x] 3.3 Load (paginated, concurrent): opted-in profiles (`prediction_reminder_opt_out = false`), today's predictions for the selected match ids, and today's `prediction_reminder_log` user ids.
- [x] 3.4 Implement a pure, exported helper that computes each player's pending matches (today's open matches minus their predicted ids) and drops players already reminded today or with nothing pending. Add unit tests for it.
- [x] 3.5 Resolve each pending player's email via `admin.auth.admin.getUserById` (skip + count on missing/error); build localized strings + fixture rows; format kickoff labels in UTC with the zone shown.
- [x] 3.6 Send via Resend `batch.send` in chunks ≤100 with `List-Unsubscribe` / `List-Unsubscribe-Post` headers and the branding sender (`getActiveBranding().emailFromName` + `withFromName`); CTA to `${siteUrl}${localePath(DEFAULT_LOCALE, "/matches?picks=needed")}`.
- [x] 3.7 Upsert `prediction_reminder_log` rows only for accepted batches (`onConflict: "user_id,reminder_date", ignoreDuplicates: true`); count emailed/failed/skipped and log a summary. Isolate per-batch failures so one failure never aborts the rest.

## 4. Cron route

- [x] 4.1 Create `app/api/cron/prediction-reminders/route.ts` (GET, `maxDuration = 60`) mirroring the quiz cron: Bearer `CRON_SECRET` auth, prod-skip when no secret, call `dispatchPredictionReminders(emailFromName)` inside try/catch, return the summary (zero on error, never 500).
- [x] 4.2 Add `{ "path": "/api/cron/prediction-reminders", "schedule": "0 12 * * *" }` to `vercel.json` crons.

## 5. Unsubscribe route

- [x] 5.1 Create `app/api/prediction-reminders/unsubscribe/route.ts` (GET + POST) that validates the UUID token and sets `prediction_reminder_opt_out = true` for the matching profile via the admin client; return a friendly, non-enumerating confirmation. Mirror the quiz unsubscribe route.

## 6. Internationalization

- [x] 6.1 Add a `predictionEmail` namespace to `messages/en.json` (subject, preheader, eyebrow, heading/headingNoName, intro, ctaLabel, footer, unsubscribeLabel, and a fixture line label e.g. "{home} vs {away}").
- [x] 6.2 Add Spanish translations to `messages/es.json`.
- [x] 6.3 Add French translations to `messages/fr.json`.

## 7. Verification

- [x] 7.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` (including the new pending-computation unit tests); fix any issues.
- [ ] 7.2 Manually invoke the cron route in a non-prod env with a bearer token and seeded today-matches + predictions; confirm correct recipients, single-send idempotency on a repeat run, and a working unsubscribe link. _(Migration pushed to the linked remote DB (`supabase db push`, 2026-06-14) and the remote schema verified by regenerating types — `prediction_reminder_log` + `profiles.prediction_reminder_opt_out` present and matching `lib/database.types.ts`. The live email-send check is intentionally NOT run here: it would email real production players. Run it against a seeded preview env with a throwaway recipient. Recipient selection, idempotency, batching, rendering, and unsubscribe are all covered by automated tests.)_
