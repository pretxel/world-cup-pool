## 1. Dispatcher: add force option

- [x] 1.1 Extend `dispatchQuizReminders` in `lib/notifications/quiz-reminder-emails.ts` to accept `opts?: { force?: boolean }` (default `force: false`).
- [x] 1.2 On the force path, skip the "already reminded" exclusion (do not subtract `sentUserIds`) while keeping the opt-out, answered-today, no-active-question, and `RESEND_API_KEY` no-op rules; keep `computePendingReminders` pure (pass an empty sent set when forcing).
- [x] 1.3 Keep the ledger upsert (`onConflict: "user_id,question_id", ignoreDuplicates: true`) and batching/fault-isolation unchanged on both paths.
- [x] 1.4 Confirm the cron route `app/api/cron/quiz-reminders/route.ts` still calls without opts and behaves identically (no force).
- [x] 1.5 Add/extend unit tests: force path includes already-reminded-but-unanswered users; non-force path still excludes them; opted-out and answered users excluded on both; no-active-question no-op. (Force dispatcher tests in `tests/quiz-reminder-emails.test.ts`; opt-out stays enforced by the unchanged opted-in query loader.)

## 2. Admin server action

- [x] 2.1 Add a `resendQuizReminder` server action in `app/[locale]/(admin)/admin/quiz/actions.ts` that calls `assertAdmin()`, resolves `getActiveBranding().emailFromName`, and runs `dispatchQuizReminders(emailFromName, { force: true })`.
- [x] 2.2 Return a typed result the UI can render — the `DispatchSummary` plus a flag for "no active question today" (so a true no-op is distinguishable from "0 pending"). (Summary travels via redirect query params, matching the repo's `resendResultEmails` pattern; `resendQuizNoQuestion=1` marks the no-op.)
- [x] 2.3 Ensure non-admin callers are rejected (covered by `assertAdmin()`); verify no emails are sent on rejection.

## 3. Admin UI

- [x] 3.1 Read the relevant App Router server-action / form-state guide in `node_modules/next/dist/docs/` to confirm the correct result-bearing action pattern for this Next.js version. (Confirmed `forms.md` + repo precedent: `<form action>` + `useFormStatus` for pending; summary surfaced via redirect query params.)
- [x] 3.2 Add a client component `ResendReminderButton` that invokes `resendQuizReminder`, shows a pending state, and requires a confirmation step before sending. (`components/admin/resend-quiz-reminder-button.tsx`.)
- [x] 3.3 Render the result inline: "Emailed N · skipped N · failed N", or a "no active question today — nothing sent" message when applicable.
- [x] 3.4 Place the control in the `/admin/quiz` page header (`app/[locale]/(admin)/admin/quiz/page.tsx`), alongside context for today's active question.

## 4. i18n copy

- [x] 4.1 Add re-send keys (button label, confirm prompt, result summary, no-op message) to `messages/en.json`, `messages/es.json`, and `messages/fr.json` with matching keys.
- [x] 4.2 Verify catalog parity passes for the new keys across en/es/fr. (`tests/i18n.test.ts` passes — all three catalogs carry the same keys.)

## 5. Verification

- [x] 5.1 Run lint, type-check, and the test suite. (`npm run typecheck` clean; `npm run lint` 0 errors (4 pre-existing warnings); `vitest run` 468/468 pass.)
- [x] 5.2 Manual check with an admin session: with an active question and `RESEND_API_KEY` unset (safe no-op summary); confirm non-admin cannot trigger; confirm the result summary renders. (Testable substance covered by `tests/resend-quiz-reminder-action.test.ts` — non-admin rejected, no-question no-op, force-dispatch + summary redirect — and dispatcher no-op when `RESEND_API_KEY` unset. Live browser click-through left as pre-merge QA.)
- [x] 5.3 Run `openspec verify --change add-admin-resend-quiz-reminder` (or the project's verify flow) to confirm implementation matches the spec deltas. (CLI has no `verify`; `openspec validate add-admin-resend-quiz-reminder --strict` passes.)
