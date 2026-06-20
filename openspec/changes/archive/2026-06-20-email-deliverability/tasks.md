## 1. Reply-To config

- [x] 1.1 In `lib/env.ts`, add `emailReplyTo: process.env.EMAIL_REPLY_TO ?? <address parsed from emailFrom>` (extract the `<addr>` inside the `Name <addr>` form, falling back to the whole string). Keep it non-nullable so a Reply-To is always available.

## 2. Thread Reply-To through every sender

- [x] 2.1 Add `replyTo: env.emailReplyTo` to the Resend payload in the single-send modules: `result-emails.ts`, `prediction-reminder-emails.ts`, `quiz-reminder-emails.ts`, `welcome-email.ts`, `group-invite-email.ts`.
- [x] 2.2 Add `replyTo: env.emailReplyTo` to each message object in the `batch.send` arrays: `results-digest-emails.ts`, `recap-digest-emails.ts`, `comeback-emails.ts`.

## 3. Tests

- [x] 3.1 Extend the existing sender tests (or add one) to assert the Resend payload includes `replyTo` and that it equals the configured/default reply address, for both a single send and a batch send.

## 4. DNS + env (ops — documented, not code)

- [x] 4.1 Document in `docs/operator-guide.md`: publish `_dmarc.edselserrano.com` TXT = `v=DMARC1; p=none; rua=mailto:worldcup@edselserrano.com; fo=1`; set Vercel prod `EMAIL_FROM=World Cup Pools <worldcup@edselserrano.com>` and `EMAIL_REPLY_TO=worldcup@edselserrano.com`; set up a mailbox/forward for `worldcup@` so replies + DMARC reports are received; redeploy prod.

## 5. Verification

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix failures.
- [x] 5.2 After the ops steps, verify: `dig +short TXT _dmarc.edselserrano.com` returns the DMARC record; a sent test email shows From `worldcup@edselserrano.com` (no "no-reply") with a working Reply-To; the deliverability audit no longer flags DMARC or no-reply.
