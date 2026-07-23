## 1. Data layer — ledger + operation kind

- [x] 1.1 Add migration `supabase/migrations/<ts>_announcement_email_log.sql`: create
  `public.announcement_email_log` (`user_id uuid pk references profiles(id) on delete cascade`,
  `sent_at timestamptz not null default now()`), enable RLS with no policies (service-role
  only), mirroring `winners_email_log`.
- [x] 1.2 In the same migration, drop + recreate the `operation_runs_kind_check` CHECK
  constraint adding `'announcement_email'` to the allowed kinds list.
- [x] 1.3 Regenerate `lib/database.types.ts` (or hand-add the `announcement_email_log` row/
  insert types) so the admin client is typed.

## 2. Email template (pure renderer)

- [x] 2.1 Create `lib/notifications/announcement-email-template.ts`: `AnnouncementEmailStrings`,
  `AnnouncementEmailData`, `AnnouncementEmailRendered`, and `renderAnnouncementEmail(data)`
  returning `{ subject, html, text }`. Reuse the fixed hex palette + SANS/MONO conventions from
  `winners-email-template.ts`.
- [x] 2.2 Render the WinScore wordmark header (replacing the "WC 26 POOL" mark), an intro, a
  "what's new" feature list (multi-league, crypto payments, and more), a CTA button to
  winscore.me, and a footer. Add a plain-text mirror (`renderText`).
- [x] 2.3 Add i18n copy under a new `announcementEmail` namespace in the `en` and `es` message
  files (subject, preheader, eyebrow, heading, intro, feature list items, ctaLabel, footer).

## 3. Dispatch (broadcast to all players)

- [x] 3.1 Create `lib/notifications/announcement-emails.ts` (`server-only`): export
  `buildAnnouncementEmailStrings(t, opts)` and `dispatchAnnouncementEmail(fromName?)`
  returning an `AnnouncementDispatchSummary` (`{ recipients, emailed, failed, skipped }`,
  extending `DispatchSummary`).
- [x] 3.2 Load all players from `profiles` (`id, email_prefs`); compute the pending set = all
  players minus those in `announcement_email_log` minus those opted out of `recap_digest`
  (`isOptedIn`). Export a pure `computePendingRecipients(...)` for unit testing.
- [x] 3.3 Resolve each recipient's address via `auth.admin.getUserById` (reuse the winners
  `resolveEmail` shape); skip + count missing/non-sendable (`isSendableEmail`).
- [x] 3.4 Send with Resend `batch.send`, chunked at the 100-message ceiling; on a rejected
  batch count `failed` and leave those players pending. Write `announcement_email_log` rows
  (`upsert onConflict user_id ignoreDuplicates`) only after the batch is accepted.
- [x] 3.5 No-op cleanly when `env.resendApiKey` is unset; surface the sender-misconfig warning
  flag via `checkEmailSenderConfig`, exactly like winners. Use `withFromName(env.emailFrom,
  fromName)` and `env.emailReplyTo`.

## 4. Email preview registry

- [x] 4.1 Add an `announcementFixture(siteUrl, locale)` to `preview-fixtures.ts` with
  deterministic sample data.
- [x] 4.2 Add `"announcement"` to `EMAIL_PREVIEW_IDS` and a `case "announcement"` in
  `renderEmailPreview` wiring `buildAnnouncementEmailStrings` + `renderAnnouncementEmail`.

## 5. Operations control-room registration

- [x] 5.1 Add `announcement_email` to `OperationKind` and `OPERATION_KINDS` in
  `lib/operations/record-run.ts`.
- [x] 5.2 Add `JOB.announcement_email` in operations `actions.ts` calling
  `dispatchAnnouncementEmail(emailFromName)` (via `getActiveBranding`), plus a
  `runAnnouncementEmail` server action.
- [x] 5.3 Wire `announcement_email → runAnnouncementEmail` into the `RUN_ACTION` map in
  `overview.tsx`. Do NOT add it to `OPERATION_SCHEDULES` (keeps it manual-only, no pause).
- [x] 5.4 Add i18n labels: `admin.operations.jobs.announcement_email` and
  `jobsDesc.announcement_email` in `en` + `es`.

## 6. Tests

- [x] 6.1 Template test (`tests/announcement-email-template.test.ts`): rendered HTML contains
  the WinScore wordmark, feature list, CTA URL; text mirror matches; HTML escaping holds.
- [x] 6.2 Dispatch test (`tests/announcement-emails.test.ts`): `computePendingRecipients`
  excludes ledgered + opted-out players; no-op when Resend key unset; ledger written only on
  batch success; summary counts correct.
- [x] 6.3 Preview test: `announcement` renders in `en` + `es` with no side effects (extend the
  existing email-previews test coverage).

## 7. Verify

- [x] 7.1 Run the test suite and typecheck; fix failures.
- [ ] 7.2 Apply the migration to remote per the manual runbook (pooler `psql`, record it,
  `NOTIFY pgrst`).
- [ ] 7.3 Preview `announcement` in the admin Operations Emails tab (both locales), then run
  `announcement_email` from the Overview and confirm the summary counts.
