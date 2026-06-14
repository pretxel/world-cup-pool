## Context

The quiz reminder email is already implemented and stable: a dispatcher
(`lib/notifications/quiz-reminder-emails.ts`) is called by a daily Vercel cron
(`app/api/cron/quiz-reminders/route.ts`). The dispatcher loads opted-in
profiles, the users who already answered today's active question, and the users
already recorded in the `quiz_reminder_log` ledger, then emails the remaining
pending set via Resend in batches of ≤100, writing ledger rows only for accepted
batches. Idempotency is keyed by `(user_id, question_id)`.

This change adds an admin-facing way to fire that same dispatch on demand, with
a deliberate twist: the manual path re-emails users the cron already reminded
(but who still have not answered). Per the decision captured in the proposal, the
control lives on the admin quiz page and performs a **force** re-send.

Constraints:
- This repository runs a Next.js with breaking changes vs. common training data;
  the App Router server-action and result-rendering details MUST be confirmed
  against `node_modules/next/dist/docs/` during implementation (per AGENTS.md).
- Admin authorization already has a pattern: `assertAdmin()` in
  `app/[locale]/(admin)/admin/quiz/actions.ts` checks `profiles.is_admin` for the
  signed-in user.
- Email actually reaching users in prod depends on `RESEND_API_KEY` and a
  configured sender; today prod uses the Resend sandbox sender, so sends only
  reach the project owner until `EMAIL_FROM` is set. The feature does not change
  this; it inherits the same gating.

## Goals / Non-Goals

**Goals:**
- Let an admin re-send the day's quiz reminder from `/admin/quiz` in one click
  (plus a confirm), without waiting for the cron.
- Re-send reaches every opted-in, still-unanswered user — including those the
  cron already reminded today (force).
- Reuse the existing dispatcher, ledger, opt-out, and email plumbing; no schema
  change.
- Give the admin immediate feedback: emailed / skipped / failed, plus a clear
  no-op message when there is no active question.

**Non-Goals:**
- Changing the cron's behavior or schedule (it stays at-most-once per day).
- Targeting a specific question/date other than today's active question, or
  selecting individual recipients.
- A new opt-out, a new email template, or any database migration.
- Per-user timezone handling (the existing UTC "today" rule is unchanged).
- Rate-limiting or audit-logging admin re-sends (noted as an open question).

## Decisions

### Add a `force` option to the existing dispatcher, don't fork it
Extend the signature to `dispatchQuizReminders(fromName?, opts?: { force?: boolean })`.
When `force` is true, the dispatcher skips the "already reminded" exclusion
(i.e. it does not subtract `sentUserIds` from the pending set) but keeps every
other rule: opt-out filter, answered-today filter, no-active-question no-op,
`RESEND_API_KEY` no-op, batching, fault isolation, and the ledger upsert
(`onConflict: "user_id,question_id", ignoreDuplicates: true`). The cron continues
to call with no opts, so its behavior is byte-for-byte unchanged.
*Implementation note:* `computePendingReminders` currently merges answered + sent
into one skip set. Keep the pure function, but pass `sentUserIds = []` (or a
`force` flag) so it excludes only answered users on the force path — preserving
unit-testability.
*Alternative considered:* a separate `forceDispatchQuizReminders`. Rejected —
duplicates the load/render/batch logic and risks drift from the cron path.

### Trigger via an admin server action, not a new API route
Add a server action (co-located in `app/[locale]/(admin)/admin/quiz/actions.ts`)
that calls `assertAdmin()`, resolves `getActiveBranding().emailFromName`, then
`dispatchQuizReminders(emailFromName, { force: true })`, and returns the
`DispatchSummary`. This reuses the page's existing auth pattern and avoids
inventing a second authenticated entry point (the cron route stays the only HTTP
endpoint, guarded by `CRON_SECRET`). The action returns the summary so the UI can
render it.
*Alternative considered:* expose a `?force=1` query on the cron route guarded by
admin session. Rejected — mixes cron-secret auth with session auth on one route
and is easy to misconfigure.

### Result-bearing UI via a small client component
The summary must be shown back to the admin, so the trigger cannot be a plain
`<form action={...}>` that returns void. Use a client component (e.g.
`ResendReminderButton`) that invokes the action through the App Router's
form-state hook and renders the returned counts ("Emailed 42 · skipped 3 ·
failed 0") or a "no active question today — nothing sent" message when the
summary is zero and no question is active. The exact hook/API (e.g.
`useActionState`) MUST be verified against the in-repo Next.js docs before
coding. The button sits in the quiz page header alongside today's-question
context so the admin knows what will be sent.

### Confirm before sending
Because this blasts real email to many users (and explicitly re-emails people),
require a confirmation step (native `confirm()` or a small dialog) before the
action runs. This is a guardrail, not a spec requirement.

### Force still writes the ledger
The force path upserts ledger rows for accepted batches exactly as the cron does.
This keeps the cron idempotent afterward (it won't double-send later the same
day) and means repeated admin re-sends are bounded only by the admin's clicks,
which the confirm step gates.

## Risks / Trade-offs

- **Admin can spam users by clicking repeatedly** → Confirm step before each
  send; force is intentional and admin-only. Audit/rate-limit deferred (open
  question).
- **Prod sender unconfigured** → Sends reach only the owner via the Resend
  sandbox until `EMAIL_FROM` is set; the UI summary may report "emailed N" while
  recipients other than the owner don't actually receive mail. Mitigation:
  documented; same limitation as the cron, out of scope to fix here.
- **Long run hits the action time budget for large recipient sets** → The
  dispatcher already batches (≤100) and the cron uses `maxDuration = 60`; a
  server action has its own budget. For the current pool size this is fine;
  revisit (e.g. move to a triggered route with `maxDuration`) if the user base
  grows large.
- **`force` accidentally enabled on the cron path** → Guarded by defaulting
  `force` to false and only the admin action passing true; covered by the
  unchanged-cron scenario in the spec.

## Migration Plan

1. Add the `force` option to `dispatchQuizReminders` (default false); confirm the
   cron route still compiles and behaves identically.
2. Add the admin server action returning `DispatchSummary`.
3. Add the client `ResendReminderButton` and wire it into the quiz page.
4. Add i18n copy (button label, confirm text, result/no-op messages) to en/es/fr.
5. Verify locally (admin session, with and without an active question; with
   `RESEND_API_KEY` unset → safe no-op). No DB migration; nothing to roll back at
   the data layer. Rollback = remove the button/action; the `force` option is
   inert when unused.

## Open Questions

- Should admin re-sends be audit-logged (who/when/how many) or rate-limited?
  Default: no, for v1.
- Should the admin be able to choose a target date/question rather than always
  today's active question? Default: today only, matching the cron.
