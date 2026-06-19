## Why

Friend groups are the product's biggest viral lever, but the social loop dead-ends at copy-paste. Today the only way to invite someone is the `InviteShare` block in `app/[locale]/(app)/groups/[id]/group-controls.tsx`, which copies the join code or the join link (`${origin}/${locale}/groups/join/${code}`) to the clipboard — the inviter then has to paste it into some other channel themselves. análisis.md flags this as medium bet **M5** ("Invitación a grupo por email con join link directo"): remove the copy-paste friction by letting a member send the invite straight from the app via email, reusing the existing Resend infra in `lib/notifications/`. The blocking dependency for email (QW1) is already resolved — `EMAIL_FROM=no-reply@edselserrano.com` on a verified domain, prod email confirmed working.

## What Changes

- Add an "invite by email" action in the group detail view (next to the existing copy-code/copy-link controls in `group-controls.tsx`) where a member enters one or more recipient email addresses and sends them a direct join link.
- Add a server action `inviteToGroupByEmailAction` (in `app/[locale]/(app)/groups/actions.ts`) that validates the caller is a member of the group, validates and de-duplicates recipient addresses, enforces rate/abuse limits, and dispatches the invite email(s).
- Add a pure, dependency-free invite email renderer (`lib/notifications/group-invite-template.ts`) following the `welcome-email-template.ts` / `result-email-template.ts` pattern: email-safe table HTML, fixed hex palette, an HTML + plain-text part, all copy passed in by the caller.
- Add a server-only sender (`lib/notifications/group-invite-email.ts`) that renders localized copy and sends through Resend using `env.emailFrom`, reusing the `isSendableEmail` guard and the `env.resendApiKey` no-op gate from `result-emails.ts`.
- The invite link reuses the existing, already-shareable `groups.join_code` and the existing `/groups/join/[code]` confirm route — no new token, table, or join mechanism. The recipient lands on the same `JoinConfirmForm` flow.
- Enforce rate/abuse limits via a new additive ledger table `group_invite_log` (per-inviter / per-group send counts in a rolling window), written/read only by the service-role admin client.
- Add a `groupInvite` i18n namespace to `messages/{en,es,fr,de}.json` for both the in-app UI strings and the email copy.
- No-op silently when `RESEND_API_KEY` is unset (mirrors the existing dispatchers).

Non-goals: SMS or share-sheet invites, referral rewards or inviter attribution (that is a separate bet, M4 / `group-referral-reward`), per-recipient accept tracking, an "auto-add the invitee to the group" flow (the recipient still confirms via the existing join screen), or generating per-invite single-use tokens.

## Capabilities

### New Capabilities
- `group-email-invite`: let a group member send a direct join link to one or more email recipients from the group detail view, reusing the existing join code and Resend email infrastructure, with rate/abuse limits.

### Modified Capabilities

## Impact

- **App**: `app/[locale]/(app)/groups/[id]/group-controls.tsx` — add an invite-by-email form/dialog beside the existing `InviteShare` copy controls. `app/[locale]/(app)/groups/actions.ts` — add `inviteToGroupByEmailAction` (validated, `useActionState`-style, returns a localized state) that authorizes the caller as a member, validates/dedupes addresses, checks rate limits, and calls the sender.
- **Lib**: new `lib/notifications/group-invite-template.ts` (pure renderer) and `lib/notifications/group-invite-email.ts` (server-only sender). Reuses `lib/env` `emailFrom`/`resendApiKey`, `lib/supabase/admin`, `lib/i18n` `localePath`, `getTranslations`, and `isSendableEmail` exactly like `welcome-email.ts` / `result-emails.ts`.
- **i18n**: new `groupInvite` namespace in `messages/{en,es,fr,de}.json` (UI labels, validation/error/success messages, and email copy).
- **Data**: one new additive table `public.group_invite_log` (Supabase migration) — records `(group_id, inviter_id, recipient_email, sent_at)` for rate limiting and abuse auditing; RLS enabled with no policies (service-role only), same posture as `result_email_log`. No change to `groups`, `group_members`, `join_group`, or `group_preview`.
- **Dependency / caveat**: deliverability depends on `EMAIL_FROM` being a Resend verified-domain sender — already satisfied in prod (`no-reply@edselserrano.com`, verified). With `RESEND_API_KEY` unset (dev/staging) the send no-ops, consistent with the other dispatchers.
