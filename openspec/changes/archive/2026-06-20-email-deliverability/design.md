## Context

All transactional mail goes through Resend in seven `lib/notifications/*` modules, each building `from` via `withFromName(env.emailFrom, fromName)` and calling either `resend.emails.send` (result, prediction-reminder, quiz-reminder, welcome, group-invite) or `resend.batch.send` (results-digest, recap-digest, comeback). None set a Reply-To. `env.emailFrom` is currently `World Cup Pools <no-reply@edselserrano.com>` (prod), read at runtime in `lib/env.ts`. The domain `edselserrano.com` is verified in Resend for sending (DKIM + SPF), but has **no DMARC record** and **receiving disabled**.

## Goals / Non-Goals

**Goals:**
- Replyable, non-no-reply sender with a Reply-To on every transactional send.
- A published DMARC record meeting large-sender requirements (monitor mode).
- One place to configure the reply address; safe defaults.

**Non-Goals:**
- Standing up a full mailbox/IMAP (a forward is enough for replies + DMARC reports — an ops step, not code).
- Inbound email handling/parsing in the app.
- Tightening DMARC to quarantine/reject now (start at `p=none`).

## Decisions

### Decision: `EMAIL_REPLY_TO` env, defaulted from the From address
Add `emailReplyTo: process.env.EMAIL_REPLY_TO ?? <address parsed from emailFrom>` to `lib/env.ts`. Senders pass `replyTo: env.emailReplyTo`. Defaulting to the From address means even without the new env, Reply-To is the (now non-no-reply) sender — no broken state.

*Why env, not hardcode:* keeps the address swappable per environment, consistent with `emailFrom`.

### Decision: Thread `replyTo` into all seven senders
Add `replyTo: env.emailReplyTo` to each Resend payload — both the single `emails.send` payloads and each message object in the `batch.send` arrays. Small, uniform edit; no shared-wrapper refactor (keeps the diff reviewable and each sender self-contained, matching the current style).

*Alternative considered:* a shared `sendTransactional()` wrapper — deferred; larger refactor across 7 modules with differing batch/single shapes, out of scope for a deliverability fix.

### Decision: Sender address `worldcup@edselserrano.com`
`EMAIL_FROM` and `EMAIL_REPLY_TO` both become `worldcup@edselserrano.com` (From keeps the `World Cup Pools` display name via `withFromName`). Not a code value — set as Vercel prod env. Requires a forward/mailbox for `worldcup@` so replies don't hard-bounce.

### Decision: DMARC `p=none` with reporting
Publish `_dmarc.edselserrano.com` TXT: `v=DMARC1; p=none; rua=mailto:worldcup@edselserrano.com; fo=1`. `p=none` satisfies the requirement and only monitors (no deliverability risk); `rua` to a same-domain address avoids the external-domain authorization record needed for cross-domain report addresses. Tighten to `p=quarantine` later once reports confirm SPF/DKIM alignment.

## Risks / Trade-offs

- **[Replies/DMARC reports bounce if `worldcup@` doesn't receive]** → ops must add a mailbox/forward; documented as a task. Until then the From is still non-no-reply (satisfies the heuristic) but replies won't be read.
- **[EMAIL_FROM is referenced in tests' expected strings]** → none assert the literal address (verified); the change is env-driven.
- **[Forgetting the redeploy]** → env is read at runtime from the deployment snapshot, so a redeploy is needed for prod to use the new From; called out in tasks.

## Migration Plan

Code: `lib/env.ts` + 7 senders (add `replyTo`). Ops: set `EMAIL_FROM`/`EMAIL_REPLY_TO` in Vercel, publish the DMARC TXT, add `worldcup@` forwarding, redeploy. No DB migration. Rollback = revert env + remove the TXT.
