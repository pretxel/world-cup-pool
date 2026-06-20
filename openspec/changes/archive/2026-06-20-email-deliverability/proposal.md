## Why

Email deliverability audit flags two issues for `edselserrano.com`:

1. **No DMARC record.** Google, Yahoo, and Microsoft require a valid DMARC record for senders; without it, transactional mail (reminders, results, digests, welcome, group invites) is more likely to be filtered or rejected.
2. **"no-reply" sender.** Mail goes out as `World Cup Pools <no-reply@edselserrano.com>`. A no-reply From signals one-way communication, lowers inbox trust, and gives recipients no way to reply (which spam filters read negatively).

Both hurt the transactional email we just made live (welcome, reminders, result/recap/comeback digests).

## What Changes

- **Sender (no-reply → replyable):** change `EMAIL_FROM` to `World Cup Pools <worldcup@edselserrano.com>` and add a **Reply-To** of `worldcup@edselserrano.com` to every transactional send. So mail is replyable and no longer advertises no-reply.
- **Reply-To plumbing:** add a nullable `EMAIL_REPLY_TO` env (defaulting to the From address) read in `lib/env.ts`, and thread `replyTo` into every Resend send (`emails.send` + `batch.send`) across the 7 sender modules.
- **DMARC:** publish `_dmarc.edselserrano.com` TXT = `v=DMARC1; p=none; rua=mailto:worldcup@edselserrano.com; fo=1` (monitor mode; satisfies the large-sender requirement without risking deliverability). DNS step, documented in the operator guide.
- **Inbox/forwarding note:** `worldcup@edselserrano.com` must actually receive (Resend has receiving disabled for the domain) — set up a mailbox or forward so replies and DMARC reports land somewhere.

## Capabilities

### New Capabilities
- `email-deliverability`: transactional email is sent from a replyable, non-no-reply address with a Reply-To, and the domain publishes a DMARC record — meeting Gmail/Yahoo/Microsoft sender requirements and improving inbox placement.

### Modified Capabilities
<!-- None at the spec level. The existing senders (result/reminder/digest/welcome/group-invite) keep their behavior; they gain a Reply-To header and a different From address (env). -->

## Impact

- **Env (ops, Vercel prod):** `EMAIL_FROM` → `World Cup Pools <worldcup@edselserrano.com>`; new `EMAIL_REPLY_TO=worldcup@edselserrano.com`. Redeploy to pick up `EMAIL_FROM` if it is build-inlined (it is read at runtime via `lib/env.ts`, so a redeploy refreshes the deployment snapshot).
- **Code:** `lib/env.ts` (+ `emailReplyTo`); the 7 `lib/notifications/*` senders add `replyTo` to their Resend payloads (`emails.send` and `batch.send`).
- **DNS (ops):** add the `_dmarc` TXT record; set up receiving/forwarding for `worldcup@`.
- **Docs:** operator guide section for the DMARC record + sender address.
- No schema change, no new dependency. The QW1 sender guard still applies.
