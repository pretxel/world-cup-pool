# group-email-invite Specification

## Purpose
Let a signed-in group member send a direct join link to one or more email recipients straight from the group detail view, removing the copy-paste friction of the existing clipboard-only invite. The send reuses the group's existing `join_code` and the existing `/groups/join/[code]` confirm flow (no new token or join mechanism) and the existing Resend email infrastructure. It is best-effort (no-ops when Resend is unconfigured, never throws out of the action) and abuse-bounded (membership authorization, recipient validation/de-duplication, a per-submission cap, and rolling-window per-inviter and per-group rate limits backed by a service-role-only ledger).

## Requirements

### Requirement: Invite a group by email
The system SHALL let a signed-in member of a group send a direct join link to one or more email recipients from the group detail view. The action MUST authorize the caller as a member of the target group before doing anything; a caller who is not a member MUST receive an error and no email SHALL be sent. The invite email SHALL link the recipient to the existing join-confirm route for the group's current `join_code` (`/groups/join/{code}`), built from `env.siteUrl` and `localePath`, reusing the existing join flow with no new token or join mechanism.

#### Scenario: Member sends an invite
- **WHEN** a signed-in member of a group submits a valid recipient email address through the invite-by-email action
- **THEN** an invite email is sent to that recipient
- **AND** the email contains a join link to `/groups/join/{code}` for that group built from `env.siteUrl`
- **AND** the action reports success for that recipient

#### Scenario: Non-member is rejected
- **WHEN** a signed-in user who is not a member of the target group submits the invite-by-email action for it
- **THEN** no email is sent
- **AND** the action returns an authorization error

#### Scenario: Signed-out caller is rejected
- **WHEN** a signed-out caller invokes the invite-by-email action
- **THEN** no email is sent
- **AND** the request is rejected as unauthenticated

### Requirement: Recipient validation and de-duplication
The action SHALL accept one or more recipient addresses, trim and lowercase each, validate each with the `isSendableEmail` guard, and de-duplicate them. The number of recipients accepted in a single submission MUST be capped at a fixed maximum. Invalid or over-cap input SHALL be reported back through the action result rather than producing a failed send.

#### Scenario: Invalid address is filtered
- **WHEN** the submission contains an address that fails `isSendableEmail` (malformed, or an undeliverable/reserved domain)
- **THEN** no email is sent to that address
- **AND** the action reports the address as invalid

#### Scenario: Duplicate addresses collapse to one send
- **WHEN** the same address appears more than once in a submission (including differing only by case or surrounding whitespace)
- **THEN** at most one email is sent to that address

#### Scenario: Too many recipients
- **WHEN** a submission contains more than the per-submission recipient maximum
- **THEN** the action returns a validation error and sends nothing

### Requirement: Rate and abuse limiting
The system SHALL record each accepted invite send in a service-role-only ledger (`public.group_invite_log`, recording group, inviter, recipient email, and send time) and SHALL enforce rolling-window limits on the number of invites an inviter may send. A submission that would exceed the per-inviter (and per-group) limit within the window MUST be rejected before sending, with the limit reported through the action result. Ledger rows SHALL be written only after the email provider accepts the corresponding message.

#### Scenario: Send is recorded
- **WHEN** an invite email is accepted by the email provider
- **THEN** a `group_invite_log` row is written for that group, inviter, and recipient with a send timestamp

#### Scenario: Over the rolling limit
- **WHEN** an inviter has already sent the maximum allowed invites within the rolling window and submits more
- **THEN** the over-limit invites are not sent
- **AND** the action returns a rate-limit error

#### Scenario: Ledger is service-role only
- **WHEN** an end user (anon or authenticated) attempts to read or write `group_invite_log` directly
- **THEN** row-level security denies access, and only the service-role admin client can read or write it

### Requirement: Invite email content and rendering
The invite email SHALL identify the inviting member by display name and the group by name, and SHALL include the join link as a prominent call to action. The email SHALL be produced by a pure, dependency-free renderer that emits both an HTML part (email-safe table layout with inline styles and fixed hex colors, no `oklch`/`var()`/stylesheets) and a plain-text part, mirroring the `welcome-email-template.ts` / `result-email-template.ts` pattern. All user-facing copy SHALL be supplied by the caller (no hardcoded strings in the renderer) and SHALL be resolved from a `groupInvite` i18n namespace present in `messages/{en,es,fr,de}.json`. The email copy and the join link SHALL be resolved at the inviter's request locale.

#### Scenario: Email names the inviter, group, and join link
- **WHEN** the invite email is rendered
- **THEN** the HTML and text parts include the inviter's display name and the group name
- **AND** they include the join link to `/groups/join/{code}` as a call to action

#### Scenario: Localized copy
- **WHEN** the inviter's request locale is one of `en`, `es`, `fr`, or `de`
- **THEN** the email subject, body copy, and the locale segment of the join link use that locale

### Requirement: Best-effort, non-blocking delivery
The invite send SHALL be best-effort and consistent with the existing dispatchers. When `RESEND_API_KEY` is unset, the sender SHALL no-op (log and return) without attempting a send and without writing the ledger. A per-recipient send failure SHALL be caught and counted, MUST NOT abort sending to the remaining recipients, and MUST NOT throw out of the action; the action SHALL report counts of sent, failed, and skipped recipients.

#### Scenario: Resend not configured
- **WHEN** `RESEND_API_KEY` is unset and the action runs
- **THEN** the sender logs that it is skipping and returns without sending
- **AND** no `group_invite_log` rows are written

#### Scenario: One bad recipient does not stop the rest
- **WHEN** a multi-recipient submission has one address the provider rejects
- **THEN** the remaining valid recipients are still sent their invites
- **AND** the action reports one failed and the others as sent
