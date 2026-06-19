## 1. Data: cooldown ledger + email pref

- [ ] 1.1 Add a Supabase migration under `supabase/migrations/` (timestamped filename, e.g. `20260620000000_comeback_email_log.sql`) creating `public.comeback_email_log (user_id uuid not null references public.profiles(id) on delete cascade, sent_at timestamptz not null default now())` with an index on `(user_id, sent_at)`; enable RLS with no policies (service-role only), matching `prediction_reminder_log`/`result_email_log`. Document the comment: written/read only by the service-role comeback dispatcher; NOT backfilled, so the first run can reach the existing inactive cohort.
- [ ] 1.2 In a migration, add the `comeback` key (default `true`) to the `profiles.email_prefs` jsonb default; existing rows are safe because a missing key reads as opted-in (no destructive backfill required).

## 2. Email preferences plumbing

- [ ] 2.1 In `lib/email-prefs.ts`, add `"comeback"` to `EMAIL_PREF_KEYS`, to `DEFAULT_EMAIL_PREFS` (`true`), to `emailPrefsSchema` (`z.boolean()`, partial), and to `normalizeEmailPrefs`.
- [ ] 2.2 Confirm `isOptedIn(prefs, "comeback")` returns the `!== false` (default-on) semantics with no code change.

## 3. Renderer: comeback-email-template.ts

- [ ] 3.1 Create `lib/notifications/comeback-email-template.ts` as a pure, dependency-free renderer modeled on `prediction-reminder-template.ts` (fixed hex palette, table layout, inline styles, no `oklch`/`var()`/stylesheets).
- [ ] 3.2 Define `ComebackEmailStrings` (subject, preheader, eyebrow, heading/headingNoName, intro, daysInactiveLabel, rankLabel, unrankedLabel, pointsLabel, matchesLabel, vs, ctaLabel, footer, unsubscribeLabel) and `ComebackEmailData` (displayName, daysSinceLastPick, rank-or-null, totalPoints, next-pickable matches, predictionsUrl, unsubscribeUrl, strings).
- [ ] 3.3 Render the brand header, intro, the days-since-last-pick + rank/points block (with an "unranked" fallback when rank is null), the next-pickable-matches list, a `/matches?picks=needed` CTA, and a footer with the unsubscribe link.
- [ ] 3.4 Emit both `html` and `text` parts and return `{ subject, html, text }`; HTML-escape all interpolated copy and data.

## 4. Dispatcher: comeback-emails.ts

- [ ] 4.1 Create `lib/notifications/comeback-emails.ts` (`server-only`) exporting `dispatchComebackEmails(fromName?: string): Promise<DispatchSummary>`, modeled on `dispatchPredictionReminders` in `prediction-reminder-emails.ts` (share `DispatchSummary`, the paginated loaders, the `resolveEmail`/`withFromName` patterns, `checkEmailSenderConfig`).
- [ ] 4.2 No-op (log + zero summary) when `env.resendApiKey` is unset; call `checkEmailSenderConfig` and carry `senderMisconfigured` on the summary when the prod sender is misconfigured, without changing the resolved sender.
- [ ] 4.3 Define named constants `INACTIVITY_DAYS = 5` and `COOLDOWN_DAYS = 14`.
- [ ] 4.4 Page-load profiles (id, display_name, unsubscribe_token, email_prefs); load each user's most recent `predictions.submitted_at`; load confirmed, still-pickable upcoming matches (`isConfirmedMatch && !isLocked`); load the most recent `comeback_email_log.sent_at` per user.
- [ ] 4.5 Implement and export a pure `computePendingComebackEmails(...)` that returns the recipient set: players with a last pick older than `INACTIVITY_DAYS`, not opted out of `comeback` (`isOptedIn`), with no cooldown row newer than `COOLDOWN_DAYS`, only when at least one pickable upcoming match exists; players with zero predictions excluded. Include each recipient's `daysSinceLastPick` and the next pickable matches.
- [ ] 4.6 Load standings from `v_leaderboard_overall` for the recipient ids (rank, display_name, total_points); recipients absent from the view render as "unranked".
- [ ] 4.7 Resolve each recipient's email via the admin `getUserById` pattern; skip missing addresses, counting them as `skipped`.
- [ ] 4.8 Build localized copy via `getTranslations({ locale: DEFAULT_LOCALE, namespace: "comebackEmail" })`; build the `/matches?picks=needed` URL from `env.siteUrl` + `localePath(DEFAULT_LOCALE, "/matches?picks=needed")`; build each unsubscribe URL from `env.siteUrl` + `/api/comeback-emails/unsubscribe?token=...`; resolve the sender via `env.emailFrom` with the optional `fromName` override.
- [ ] 4.9 Render per-recipient and batch-send (≤100) via `resend.batch.send` with `List-Unsubscribe`/`List-Unsubscribe-Post` headers; on an accepted batch, insert `comeback_email_log` rows (`user_id`, default `sent_at`) for that batch; on a rejected batch, log + count `failed` and leave those recipients pending.
- [ ] 4.10 Return `{ emailed, failed, skipped }` (plus `senderMisconfigured` when applicable).

## 5. One-click unsubscribe route

- [ ] 5.1 Create `app/api/comeback-emails/unsubscribe/route.ts` modeled on `app/api/prediction-reminders/unsubscribe/route.ts`: GET + RFC 8058 one-click POST, UUID-validate the `token`, set only `email_prefs.comeback = false` on the matching profile via `normalizeEmailPrefs`, idempotent and non-enumerating, returning the same friendly confirmation regardless of token match.

## 6. Cron route

- [ ] 6.1 Create `app/api/cron/comeback-emails/route.ts` modeled on `app/api/cron/prediction-reminders/route.ts`: `export const maxDuration = 60`, Bearer `CRON_SECRET` auth (allow non-prod when unset, 401 on mismatch, 204 skip on missing-env in prod).
- [ ] 6.2 Wrap the dispatch in `recordRun("comeback_emails", "cron", async () => { const { emailFromName } = await getActiveBranding(); return await dispatchComebackEmails(emailFromName); })`; isolate failures (catch → log → zero summary) and return the summary as JSON.
- [ ] 6.3 Register the route in `vercel.json` `crons` on a fixed UTC schedule offset from the existing crons, e.g. `0 15 * * *`.

## 7. Operations integration

- [ ] 7.1 Add `"comeback_emails"` to `OperationKind` and `OPERATION_KINDS` in `lib/operations/record-run.ts`; confirm the existing failure-key classification yields `success`/`partial` for the comeback summary with no other change.
- [ ] 7.2 Add a matching `comeback_emails` entry to `OPERATION_SCHEDULES` in `lib/operations/schedule.ts` (cron + `hourUtc`) consistent with `vercel.json`.

## 8. i18n

- [ ] 8.1 Add a `comebackEmail` namespace to `messages/en.json` with all `ComebackEmailStrings` keys.
- [ ] 8.2 Mirror the namespace in `messages/es.json`, `messages/fr.json`, and `messages/de.json` with translated copy.

## 9. Verification

- [ ] 9.1 Run typecheck (`tsc --noEmit` / project typecheck script) — no errors.
- [ ] 9.2 Run lint — no new violations.
- [ ] 9.3 Add/run unit tests: the pure renderer (HTML + text contain days-since-last-pick, rank-or-unranked, next matches, and the `/matches?picks=needed` link); `computePendingComebackEmails` (inactive + actionable included; recently-active suppressed; zero-prediction excluded; opt-out dropped; within-cooldown suppressed; no-pickable-match → empty); no-op when `RESEND_API_KEY` unset.
- [ ] 9.4 Manual check: with `RESEND_API_KEY` set and `EMAIL_FROM` a verified-domain sender, seed an inactive player (last pick > 5 days, a pickable upcoming match), hit `/api/cron/comeback-emails` with a valid bearer twice; confirm exactly one comeback email arrives, the rank/days/next-matches render, the second run re-sends nothing (cooldown), and an `operation_runs` row appears with kind `comeback_emails`.
- [ ] 9.5 Manual check: follow the email's footer unsubscribe link and confirm `email_prefs.comeback` flips to `false` and a subsequent run skips that player.
