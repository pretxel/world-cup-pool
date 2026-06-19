## 1. Guard helper

- [ ] 1.1 Add a pure `checkEmailSenderConfig()` (e.g. `lib/notifications/email-sender-config.ts`) reading `env.emailFrom`, `env.resendApiKey`, and `NODE_ENV`; centralize the sandbox-address constant `onboarding@resend.dev`.
- [ ] 1.2 Return a small result, e.g. `{ isSandboxSender, missingApiKey, isProduction, shouldWarn, message }`, where `isSandboxSender` matches on the address (not the display name) and `shouldWarn` is true only in production when `isSandboxSender || missingApiKey`.

## 2. Dispatcher warnings

- [ ] 2.1 In `lib/notifications/result-emails.ts` (`dispatchResultEmails` and `forceDispatchResultEmails`), call the guard at the top and `console.warn` a single clear line on a production misconfiguration; keep the existing `RESEND_API_KEY`-unset graceful no-op (now warning instead of silent).
- [ ] 2.2 Apply the same guard + `console.warn` at the top of `dispatchPredictionReminders` (`lib/notifications/prediction-reminder-emails.ts`).
- [ ] 2.3 Apply the same guard + `console.warn` at the top of `dispatchQuizReminders` (`lib/notifications/quiz-reminder-emails.ts`).

## 3. Summary flag

- [ ] 3.1 Extend the shared `DispatchSummary` with an optional misconfiguration flag (e.g. `senderMisconfigured?: boolean` and/or `senderWarning?: string`); update the `ZERO` summary defaults in each dispatcher.
- [ ] 3.2 Set the flag from the guard result in each dispatcher's returned summary (including the no-op/zero-summary early returns) without changing `emailed`/`failed`/`skipped` semantics.
- [ ] 3.3 Confirm `recordRun` (`lib/operations/record-run.ts`) carries the flag through unchanged and that `deriveStatus` (keyed on `failed`/`errors`) is unaffected; the cron routes already `console.log(JSON.stringify(summary))` so the flag reaches cron logs with no route edits.

## 4. Docs

- [ ] 4.1 Document the required prod config (`EMAIL_FROM` = Resend verified-domain sender, `RESEND_API_KEY` set) and what the misconfiguration warning means in README or the ops doc.

## 5. Verification

- [ ] 5.1 Add unit tests for `checkEmailSenderConfig()`: production sandbox sender → warn; production missing key → warn; production verified sender + key → no warn; non-production → no warn; sandbox match ignores a custom display name.
- [ ] 5.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix failures.
- [ ] 5.3 Manually verify: with `NODE_ENV=production` and the sandbox/no-key config, a dispatcher run logs the warning and the returned summary carries the flag; with a verified sender + key, no warning and the flag is clear; non-prod behavior is unchanged.
