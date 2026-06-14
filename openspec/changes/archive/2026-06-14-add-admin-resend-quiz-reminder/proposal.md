## Why

Today the quiz reminder email only goes out via a once-a-day Vercel cron, and its ledger guarantees at-most-once delivery per user per day — so if a send misfires, fires before a question is published, or the team simply wants to nudge stragglers again, there is no way to trigger another reminder without waiting for the next day. Admins need an on-demand "re-send" they can fire from the admin UI.

## What Changes

- Add a **manual re-send** control to the admin quiz page (`/admin/quiz`) that an admin can click to dispatch the day's quiz reminder email on demand.
- The control performs a **force re-send**: it emails every opted-in user who has not answered today's active question, **even if the cron already reminded them today** (the once-per-day ledger exclusion is bypassed for this path). The ledger is still upserted so the cron stays idempotent afterward.
- Extend the existing dispatcher `dispatchQuizReminders` with an opt-in `force` flag. The cron path is unchanged (force defaults off); only the admin action passes `force: true`.
- Add an admin-only server action that authorizes the caller, runs the dispatch, and returns a result summary (emailed / failed / skipped).
- Surface the result inline in the admin UI (e.g. "Emailed 42, skipped 3, failed 0"), with a confirmation step before sending since this blasts real email, and a clear no-op message when there is no active question for the current UTC day.
- Add the supporting UI copy to the `quizEmail`/admin message catalogs for en, es, and fr.

## Capabilities

### New Capabilities
<!-- None. This builds on the existing daily-quiz-email capability. -->

### Modified Capabilities
- `daily-quiz-email`: Add an admin-triggered, on-demand re-send of the day's reminder that may re-email already-reminded (but still-unanswered) users, distinct from the once-per-day cron path. Opt-out and answered-state exclusions still apply; only the at-most-once ledger exclusion is bypassed on this path.

## Impact

- **Admin UI**: `app/[locale]/(admin)/admin/quiz/page.tsx` gains a re-send control; a small client component renders the action result.
- **Server action**: new admin action (in `app/[locale]/(admin)/admin/quiz/actions.ts`) — `assertAdmin()` then `dispatchQuizReminders(emailFromName, { force: true })`, returning the `DispatchSummary`.
- **Lib**: `lib/notifications/quiz-reminder-emails.ts` — add a `force` option that skips the "already reminded" exclusion while keeping every other eligibility rule and the ledger upsert.
- **i18n**: new admin/re-send keys in `messages/{en,es,fr}.json`.
- **No DB changes**: reuses `quiz_reminder_log`, `quiz_reminder_opt_out`, and existing email plumbing (Resend, admin Supabase client, branding).
- **Operational note**: in prod the Resend sender is currently unconfigured (sandbox), so real sends only reach the project owner until `EMAIL_FROM` is set — the re-send respects the same `RESEND_API_KEY`/sender gating as the cron.
