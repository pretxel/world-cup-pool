## Context

The daily quiz (`daily-quiz` capability) keys exactly one `quiz_questions` row to
each UTC calendar day via `active_on = (now() at time zone 'utc')::date`. Users
answer once per question (`quiz_answers`, UNIQUE(user_id, question_id)) and build
a UTC-day streak (`computeStreak` in `lib/quiz.ts`). The public answer route is
`/[locale]/quiz`.

Transactional email already exists for match results
(`result-email-notifications`): `lib/notifications/result-emails.ts` dispatches
via Resend, batches ≤100 per `resend.batch.send`, no-ops when `RESEND_API_KEY` is
unset, resolves each recipient's address from `auth.users` via
`admin.auth.admin.getUserById`, renders copy in `DEFAULT_LOCALE` with a pure
renderer (`result-email-template.ts`), and guarantees at-most-once delivery with
the `result_email_log(match_id, user_id)` ledger. Those result emails fire
**inline** inside the `sync-matches` cron — there is no general-purpose daily
mailer.

Cron is Vercel-native (`vercel.json` + `app/api/cron/*` GET routes), authed with
`Authorization: Bearer ${CRON_SECRET}`, and runs in **UTC**. Constraints today:
emails live only in `auth.users`; `profiles` (id, display_name, is_admin, …) has
no email-preference column; there is no per-user email locale.

## Goals / Non-Goals

**Goals:**
- One reminder email per day to each eligible user to answer the day's quiz.
- At-most-once per user per day, idempotent across re-runs (cron retries, manual).
- Only nudge users who actually need it (not answered yet) and who consent
  (not opted out); never email when there is no active question.
- Reuse the proven Resend dispatch / ledger / pure-renderer patterns.
- Ship a legitimate bulk email: unsubscribe link + `List-Unsubscribe` header.

**Non-Goals:**
- Per-user email **locale** — send in `DEFAULT_LOCALE` (en), like result emails.
- Per-user **timezone** / "send at 9am local" — v1 sends at a fixed UTC hour.
- An admin force-resend path (result emails have one for correctness repair;
  reminders have no such use case yet).
- Touching the `daily-quiz` or `result-email-notifications` specs/flows.
- Open/click analytics, HTML snapshots, or a preference center beyond opt-out.

## Decisions

### Decision: A standalone capability + dispatcher, not an extension of result emails

New files `lib/notifications/quiz-reminder-emails.ts` (dispatcher) and
`lib/notifications/quiz-reminder-template.ts` (pure renderer), parallel to the
result-email pair. The dispatcher mirrors result-emails' shape:
`dispatchQuizReminders(fromName?) → { emailed, skipped, failed }`, env-gated on
`RESEND_API_KEY`, batching ≤100, ledger-stamped after a successful batch.

- **Why:** Reminders are recurring/time-driven with their own recipient logic and
  ledger; result emails are event-driven and per-match. Coupling them would
  overload one module and collide with the in-flight `admin-force-result-email`
  change. Sharing the *patterns* (not the functions) keeps each path simple.
- **Alternative — extend `dispatchResultEmails`/`result_email_log` with a type
  column:** rejected. Different keys (question vs match), different trigger, and
  spec-governance conflict.

### Decision: Recipient set driven off `profiles`, email resolved per-id

Eligibility query: from `profiles p`, `LEFT JOIN quiz_answers qa ON qa.user_id =
p.id AND qa.question_id = <today>`, `LEFT JOIN quiz_reminder_log qrl ON
qrl.user_id = p.id AND qrl.question_id = <today>`, `WHERE qa.user_id IS NULL AND
qrl.user_id IS NULL AND p.quiz_reminder_opt_out = false`. For each surviving id,
resolve the address with `admin.auth.admin.getUserById` (the existing
`resolveEmail` pattern), skipping ids with no/invalid email.

- **Why:** `profiles` enumerates every user id; the three-way anti-join expresses
  "needs reminding" directly in SQL and stays idempotent. Per-id resolution
  reuses the exact helper result-emails already trusts.
- **Alternative — `auth.admin.listUsers()` pagination:** rejected; messier paging
  and still needs the answered/ledger filter applied in app code.

### Decision: `quiz_reminder_log(user_id, question_id)` ledger, PK on both

At-most-once is keyed to the question, and there is exactly one question per UTC
day, so one ledger row per user per day. Rows are written **after** the batch send
succeeds, with `onConflict` ignore-duplicates — identical to `result_email_log`.
RLS enabled, no policies (service-role only). FKs cascade on user/question delete.

- **Why:** Reuses a pattern the team already operates and reasons about. A crash
  between send and stamp leaves the pair recoverable next run (at-most-once held
  by the ledger check; worst case a rare duplicate, logged loudly — same trade
  result emails accept).

### Decision: Fixed daily UTC schedule

`vercel.json`: `{ "path": "/api/cron/quiz-reminders", "schedule": "0 13 * * *" }`
(13:00 UTC — after the 00:00 UTC question flip, morning in the Americas / midday
in Europe). The route sets `export const maxDuration = 60`.

- **Why:** Vercel crons are UTC-only; a single mid-day hour is the best blunt
  compromise without per-user timezones. The hour is one line to change.
- **Alternative — multiple sends or timezone-aware dispatch:** deferred to the
  non-goal (needs a `profiles.timezone` column and hourly cron).

### Decision: Render in `DEFAULT_LOCALE`, add `quizEmail` namespace to all locales

Copy via `getTranslations({ locale: DEFAULT_LOCALE, namespace: 'quizEmail' })`.
Keys added to en/es/fr for catalog parity (the i18n key-parity test), even though
only `en` is used at send time. The renderer is pure: `renderQuizReminderEmail(
{ strings, displayName, quizUrl, unsubscribeUrl, streak }) → { subject, html,
text }`, inline hex styling and a plain-text fallback like the result template.

- **Why:** Matches the established email-locale stance (`i18n` spec: cron is a
  non-request context → `DEFAULT_LOCALE`). Per-user locale is one future change
  that can migrate both email systems together.

### Decision: Opt-out + tokenized one-click unsubscribe

Add `profiles.quiz_reminder_opt_out boolean not null default false` and
`profiles.unsubscribe_token uuid not null default gen_random_uuid()`. The email
footer links to `/api/quiz-reminders/unsubscribe?token=<token>` (GET, no auth,
idempotent flip to opted-out), and the message carries a `List-Unsubscribe`
header pointing at the same URL.

- **Why:** Daily bulk mail to every user is marketing-adjacent; an unsubscribe is
  required for CAN-SPAM/GDPR hygiene and Resend deliverability. A per-user opaque
  token lets a logged-out click unsubscribe safely.
- **Alternative — opt-IN only:** rejected; the request is "email each user," so
  default-on with easy opt-out matches intent while staying compliant.

### Decision: Streak as a best-effort engagement hook

After the eligible set is known, batch-load those users' `quiz_answers.answered_at`
and run `computeStreak` per user; pass the number to the renderer so copy can read
"keep your N-day streak alive" (omit the clause when streak is 0/unknown).

- **Why:** `computeStreak` already exists; one extra grouped query. If it fails,
  the email still sends with generic copy — never block a send on the hook.

## Risks / Trade-offs

- **Deliverability / spam complaints from daily bulk mail** → only email users who
  haven't answered (not the whole base every day), one send per day, visible
  unsubscribe + `List-Unsubscribe` header, opt-out respected before send.
- **N× `getUserById` calls per run** → acceptable at pool scale and identical to
  result-emails; if the base grows, switch to a cached `listUsers` sweep (noted,
  not built).
- **Ledger write fails after a successful batch** → possible duplicate next run;
  mirror result-emails' loud `[quiz-reminders] ledger write failed` log; bounded
  to one extra send.
- **Fixed UTC send time hits some users at an odd local hour** → documented
  limitation; per-user timezone is future work.
- **No active question for the day** (gap day) → dispatcher returns a zero summary
  and sends nothing; cron still 200s.
- **`RESEND_API_KEY` unset (preview/dev)** → no-op zero summary, no throw, like
  result emails.
- **Large base exceeds one batch** → chunk into ≤100-message batches; ledger
  stamped per successful batch so a mid-run failure doesn't lose prior progress.

## Migration Plan

Additive. One deploy ships: the migration (`quiz_reminder_log` + two `profiles`
columns), the dispatcher + renderer + cron route + unsubscribe handler, the
`quizEmail` messages, and the `vercel.json` cron entry. The cron only does work
once the schedule fires and `RESEND_API_KEY` is set.

Rollback: remove the `vercel.json` cron entry (stops all sends immediately);
revert the code. The new table and `profiles` columns are inert if left in place;
no data backfill is required (absence of a ledger row simply means "not yet sent,"
and there are no past days to retro-send because the cron starts fresh).

## Open Questions

- Final send hour (defaulting to 13:00 UTC) — product call, trivially adjustable.
- Should reminders target only "engaged" users (ever answered) instead of all
  not-answered users? v1 targets all not-answered, opt-out respected.
- Per-user locale and timezone — explicitly deferred; both email systems migrate
  together when a `profiles.locale`/`profiles.timezone` is introduced.
