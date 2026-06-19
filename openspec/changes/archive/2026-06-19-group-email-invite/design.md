## Context

Group invites today are clipboard-only. `InviteShare` in `app/[locale]/(app)/groups/[id]/group-controls.tsx` renders the group's `join_code` and a deep link `${window.location.origin}/${locale}/groups/join/${code}`, each behind a "copy" button. The inviter must then move that string into another app to actually reach anyone. The destination already works end-to-end: `/groups/join/[code]/page.tsx` previews the group via the `group_preview(p_code)` RPC and `JoinConfirmForm` calls `join_group(p_code)` to add the caller. So the only missing piece for M5 is a way to *send* that existing link by email.

The repo has a mature transactional-email pattern in `lib/notifications/`:

- A **pure renderer** (`welcome-email-template.ts`, `result-email-template.ts`) builds email-safe HTML (table layout, inline styles, fixed hex palette mirroring the app's light theme, no `oklch`/`var()`/stylesheets) plus a plain-text part, with all copy passed in by the caller as a `*EmailStrings` object — fully unit-testable, no DB/network.
- A **server-only sender** (`welcome-email.ts`, `result-emails.ts`, `quiz-reminder-emails.ts`) gates on `env.resendApiKey`, builds localized strings via `getTranslations`, derives URLs from `env.siteUrl` + `localePath`, sends through `new Resend(env.resendApiKey)` using `env.emailFrom`, and guards recipients with `isSendableEmail`.

Group actions live in `app/[locale]/(app)/groups/actions.ts`, which already has the `useActionState`-style validated pattern (`createGroupAction`, `joinGroupAction`) returning `{ error?: string }` where `error` is a `groups`-namespace translation key, plus `requireUserClient()` for auth. The blocking email dependency (análisis.md QW1) is resolved: prod `EMAIL_FROM=no-reply@edselserrano.com` on a verified domain, confirmed delivering.

This feature is a thin send-path over existing primitives. The only genuinely new concern is abuse: an in-app "type any email, we send it" action is a spam/abuse vector, so it needs validation and rate limiting.

## Goals / Non-Goals

**Goals:**
- Let any member of a group send a direct join link to one or more email addresses from the group detail view, with no copy-paste.
- Reuse the existing `join_code` link and `/groups/join/[code]` confirm flow — no new token, table, or join mechanism for the link itself.
- Reuse the existing renderer/sender/Resend/i18n pattern with no new third-party dependency.
- Be best-effort and consistent with the other dispatchers: no-op when `RESEND_API_KEY` is unset; never let an email failure corrupt the action result.
- Constrain abuse: validate/dedupe addresses, cap recipients per submission, and cap total invites per inviter (and per group) in a rolling window.
- Localize all UI and email copy across `en`, `es`, `fr`, `de`.

**Non-Goals:**
- SMS, share-sheet, or any non-email channel.
- Referral rewards, inviter attribution, or `invited_by_user_id` — that is the separate `group-referral-reward` bet (M4).
- Per-recipient accept/open tracking or single-use, expiring invite tokens.
- Auto-joining the recipient (they still confirm via the existing join screen) or pre-creating placeholder memberships.
- Changing the existing clipboard copy controls, the join RPCs, or RLS for end users.

## Decisions

- **Reuse the join code, do not mint tokens.** The invite email links to `${env.siteUrl}${localePath(locale, "/groups/join/" + joinCode)}` — the exact link the copy button already produces. The join code is already a shareable secret; introducing per-invite tokens would add a table, an accept endpoint, and expiry logic for no M5 benefit. Recipient confirmation stays on the existing `JoinConfirmForm`.
- **Authorize on membership, server-side.** `inviteToGroupByEmailAction` resolves the caller via `requireUserClient()` and confirms membership of the target group (a `group_members` row for `(group_id, user.id)`, which RLS already scopes) before doing anything. Non-members get a generic error and no send.
- **Locale for the email.** Resolve invite copy at the *inviter's current request locale* (passed from the form like the other group actions pass `locale`), not `DEFAULT_LOCALE` — unlike the cron dispatchers, this action runs in a request context with a known locale, and the invite is "from" the inviter. Build the join URL with that same locale so the recipient lands in a sensible language.
- **Validation + dedupe.** Recipients are submitted as a small list (comma/newline separated, parsed server-side). Each is trimmed, lowercased, validated with `isSendableEmail`, and de-duplicated. The submission is capped at a small `MAX_RECIPIENTS_PER_INVITE` (e.g. 10). Invalid entries are reported back via the action state rather than silently dropped.
- **Rate / abuse limiting via an additive ledger.** Add `public.group_invite_log(group_id, inviter_id, recipient_email, sent_at)`. Before sending, the action counts the inviter's rows in a rolling window (e.g. last 24h) and rejects when over `MAX_INVITES_PER_INVITER_PER_DAY`; it also caps per (inviter, group). Rows are written only after Resend accepts each message — so the ledger reflects real sends and survives idempotent retries. The table is service-role-only (RLS enabled, no policies), the same posture as `result_email_log`; the action reads/writes it through the admin client.
- **Best-effort, no-op gating.** If `env.resendApiKey` is unset, the sender logs and returns without sending (identical to `dispatchResultEmails` / `sendWelcomeEmail`). Per-recipient send failures are counted and surfaced in the action result; one bad address does not abort the rest.
- **Sender identity.** Use `env.emailFrom` (prod `no-reply@edselserrano.com`, verified). The email body identifies the inviter by display name and the group by name so the recipient has context; the `From` stays the brand sender for deliverability.
- **UI placement.** Add the invite-by-email control inside `group-controls.tsx` next to `InviteShare` (a small form or a dialog with a textarea/inputs + send button), wired to the action via `useActionState`, showing per-submission success/error counts.

## Risks / Trade-offs

- **Abuse / spam vector.** A logged-in user could try to blast addresses or use the app as an open relay. Mitigated by membership authorization, per-submission recipient cap, per-inviter and per-group rolling-window caps via `group_invite_log`, `isSendableEmail` filtering, and the brand `From` sender (so any abuse is traceable and rate-bounded). Caps are intentionally conservative defaults and can be tuned.
- **Join code is a bearer secret.** Anyone with the code/link can join, and emailing it widens distribution. This is already true of the copy-link button; the invite does not lower the bar. If a code leaks, the existing remedy (owner controls / future code rotation) applies — out of scope here.
- **No accept tracking / no attribution.** We can't (yet) tell which invite converted, because we reuse the shared join code and add no per-invite token. Acceptable for M5; conversion attribution and rewards are the separate `group-referral-reward` bet (M4), which can build on `group_invite_log` later.
- **`RESEND_API_KEY` unset (dev/staging).** The send no-ops silently and nothing is logged to `group_invite_log`. Consistent with existing dispatchers; the UI should still report a sensible result.
- **Best-effort delivery.** A transient Resend error means some recipients of a multi-address submission may not receive the email; the action reports counts but does not retry. Intentional — a friend invite is not worth a retry queue.
- **DB migration required.** One new additive table `public.group_invite_log` under `supabase/migrations/` (timestamped). No cron and no Supabase Realtime are needed for this change.
