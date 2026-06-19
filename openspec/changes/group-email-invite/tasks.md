## 1. Data: invite ledger for rate limiting

- [ ] 1.1 Add a Supabase migration under `supabase/migrations/` with a timestamped filename creating `public.group_invite_log (group_id uuid references public.groups(id) on delete cascade, inviter_id uuid references public.profiles(id) on delete cascade, recipient_email text not null, sent_at timestamptz not null default now())` plus an index on `(inviter_id, sent_at)` for rolling-window counts.
- [ ] 1.2 Enable RLS with no policies (service-role-only, mirroring `result_email_log`); document the "definer/service-role only" posture in the migration comment.

## 2. Renderer: group-invite-template.ts

- [ ] 2.1 Create `lib/notifications/group-invite-template.ts` as a pure, dependency-free renderer modeled on `welcome-email-template.ts` (fixed hex palette, table layout, inline styles, no `oklch`/`var()`/stylesheets).
- [ ] 2.2 Define `GroupInviteEmailStrings` (subject, preheader, eyebrow, heading, intro, joinCta, footer) and `GroupInviteEmailData` (inviterName, groupName, joinUrl, strings).
- [ ] 2.3 Render the brand header, an intro naming the inviter and group, the join link as a prominent CTA button, and a footer; emit both `html` and `text` parts and return `{ subject, html, text }`; HTML-escape all interpolated copy.

## 3. Sender: group-invite-email.ts

- [ ] 3.1 Create `lib/notifications/group-invite-email.ts` (`server-only`) exporting a sender that takes the group id/name, inviter display name, join code, locale, and the validated recipient list.
- [ ] 3.2 No-op (log + return) when `env.resendApiKey` is unset; do not write the ledger in that case.
- [ ] 3.3 For each recipient, build the join URL from `env.siteUrl` + `localePath(locale, "/groups/join/" + joinCode)`, render localized copy via `getTranslations({ locale, namespace: "groupInvite" })`, and send a single message via `new Resend(env.resendApiKey).emails.send` using `env.emailFrom`.
- [ ] 3.4 On each accepted send, insert a `group_invite_log` row via the admin client; catch and count per-recipient failures without throwing; return `{ sent, failed, skipped }` counts.

## 4. Server action

- [ ] 4.1 Add `inviteToGroupByEmailAction` to `app/[locale]/(app)/groups/actions.ts` following the validated `useActionState` pattern (returns a localized `{ error?, ... }` state keyed to the `groupInvite`/`groups` namespace).
- [ ] 4.2 Resolve the caller via `requireUserClient()`; confirm a `group_members` row for `(group_id, user.id)` before proceeding, else return an authorization error.
- [ ] 4.3 Parse the recipients field (comma/newline separated), trim+lowercase, validate each with `isSendableEmail`, de-duplicate, and cap at `MAX_RECIPIENTS_PER_INVITE`; report invalid/over-cap input in the state.
- [ ] 4.4 Enforce rolling-window rate limits by counting recent `group_invite_log` rows for the inviter (and per group) via the admin client; reject over-limit submissions with a rate-limit error before sending.
- [ ] 4.5 Load the group name and the inviter's display name, call the sender, and return the sent/failed/skipped counts in the action state; `revalidatePath` the group page if appropriate.

## 5. UI

- [ ] 5.1 In `app/[locale]/(app)/groups/[id]/group-controls.tsx`, add an invite-by-email control next to the existing `InviteShare` copy block — a form or dialog with a recipients input/textarea and a send button, wired to `inviteToGroupByEmailAction` via `useActionState`.
- [ ] 5.2 Show localized success/error feedback (sent/failed/skipped counts, invalid-address and rate-limit messages) using `sonner`/inline state, consistent with the existing controls.

## 6. i18n

- [ ] 6.1 Add a `groupInvite` namespace to `messages/en.json` with all `GroupInviteEmailStrings` keys plus the UI labels and validation/error/success messages.
- [ ] 6.2 Mirror the namespace in `messages/es.json`, `messages/fr.json`, and `messages/de.json` with translated copy.

## 7. Verification

- [ ] 7.1 Run typecheck (`tsc --noEmit` / project typecheck script) — no errors.
- [ ] 7.2 Run lint — no new violations.
- [ ] 7.3 Add/run unit tests: the pure renderer (HTML + text contain inviter name, group name, and join link), the action's authorization (non-member rejected), recipient validation/dedupe/cap, and rate-limit enforcement; the sender's no-op when `RESEND_API_KEY` is unset.
- [ ] 7.4 Manual check: as a group member with `RESEND_API_KEY` set and `EMAIL_FROM=no-reply@edselserrano.com`, send an invite to a deliverable address; confirm the email arrives, the join link opens the `/groups/join/[code]` confirm screen, joining works, and the send is recorded in `group_invite_log`; confirm exceeding the per-inviter limit is rejected.
