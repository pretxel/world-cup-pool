## 1. Data: one-time guard column

- [ ] 1.1 Add a Supabase migration adding nullable `welcome_email_sent_at timestamptz` to `public.profiles` (no default).
- [ ] 1.2 Confirm the column is writable by the service-role (admin) client and requires no end-user RLS change; document this in the migration comment.

## 2. Renderer: welcome-email-template.ts

- [ ] 2.1 Create `lib/notifications/welcome-email-template.ts` as a pure, dependency-free renderer modeled on `result-email-template.ts` (fixed hex palette, table layout, inline styles, no `oklch`/`var()`/stylesheets).
- [ ] 2.2 Define `WelcomeEmailStrings` (subject, preheader, eyebrow, heading, headingNoName, intro, the three loop blurbs + CTA labels for quiz/groups/leaderboard, footer) and `WelcomeEmailData` (displayName, quizUrl, groupsUrl, leaderboardUrl, strings).
- [ ] 2.3 Render the brand header, a personalized intro, and three oriented sections (daily quiz, friend groups, leaderboard) each with its deep link, plus a footer.
- [ ] 2.4 Emit both `html` and `text` parts and return `{ subject, html, text }`; HTML-escape all interpolated copy.

## 3. Sender: welcome-email.ts

- [ ] 3.1 Create `lib/notifications/welcome-email.ts` (`server-only`) exporting `sendWelcomeEmail(userId: string)` following the `result-emails.ts`/`quiz-reminder-emails.ts` pattern.
- [ ] 3.2 No-op (log + return) when `env.resendApiKey` is unset.
- [ ] 3.3 Read `profiles` (display_name, welcome_email_sent_at) via the admin client; return early if `welcome_email_sent_at` is already non-null.
- [ ] 3.4 Resolve the recipient's email via admin `getUserById`; skip when missing or failing `isSendableEmail` (reuse/share the guard from `result-emails.ts`).
- [ ] 3.5 Build localized copy via `getTranslations({ locale: DEFAULT_LOCALE, namespace: "welcomeEmail" })`; build quiz/groups/leaderboard URLs from `env.siteUrl` + `localePath(DEFAULT_LOCALE, ...)`.
- [ ] 3.6 Send a single message via `new Resend(env.resendApiKey).emails.send` using `env.emailFrom`; on success stamp `profiles.welcome_email_sent_at = now()`.
- [ ] 3.7 Catch and log all errors; never throw to the caller.

## 4. Wire into onboarding

- [ ] 4.1 In `app/[locale]/onboarding/actions.ts` `setDisplayName`, after the successful `profiles` update and before `redirect("/matches")`, call `sendWelcomeEmail(user.id)` wrapped so any rejection is swallowed/logged and the redirect still runs.

## 5. i18n

- [ ] 5.1 Add a `welcomeEmail` namespace to `messages/en.json` with all `WelcomeEmailStrings` keys.
- [ ] 5.2 Mirror the namespace in `messages/es.json`, `messages/fr.json`, and `messages/de.json` with translated copy.

## 6. Verification

- [ ] 6.1 Run typecheck (`tsc --noEmit` / project typecheck script) — no errors.
- [ ] 6.2 Run lint — no new violations.
- [ ] 6.3 Add/run unit tests for the pure renderer (HTML + text contain the three loop links; name vs. no-name heading) and the sender's one-time guard (no second send when `welcome_email_sent_at` is set; no-op when `RESEND_API_KEY` unset; marker stamped only on success).
- [ ] 6.4 Manual check: complete onboarding as a fresh user with `RESEND_API_KEY` set and `EMAIL_FROM` pointing at a verified-domain sender; confirm one welcome email arrives, links resolve to `/quiz`, `/groups`, `/leaderboard`, and re-running onboarding does not resend.
- [ ] 6.5 Confirm the `EMAIL_FROM` prod dependency (análisis.md QW1) is noted for deployment — without a verified-domain sender the email reaches only the account owner.
