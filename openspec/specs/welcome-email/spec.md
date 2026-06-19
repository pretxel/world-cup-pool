# welcome-email Specification

## Purpose
Send a one-time orientation email to a new user right after they set their display name during onboarding, orienting them to the three core loops — the daily quiz, friend groups, and the leaderboard — with a deep link into each. The send is best-effort (never blocks or breaks onboarding), idempotent via a one-time marker on the user's profile, and no-ops when Resend is unconfigured.

## Requirements

### Requirement: One-time welcome email after onboarding
The system SHALL send a single welcome email to a user the first time they successfully set their display name during onboarding (`setDisplayName` in `app/[locale]/onboarding/actions.ts`). The send SHALL be triggered after the `profiles.display_name` update succeeds and before the redirect to `/matches`. The send SHALL NOT be repeated: once a welcome email has been sent for a user, subsequent calls to `setDisplayName` (including later display-name edits) SHALL NOT send another welcome email.

#### Scenario: New user completes onboarding
- **WHEN** an authenticated user who has never been sent a welcome email submits a valid display name to `setDisplayName`
- **THEN** their `profiles.display_name` is updated
- **AND** a welcome email is sent to the user's account email address
- **AND** the user is redirected to `/matches`

#### Scenario: Returning user edits their display name
- **WHEN** a user who has already been sent a welcome email calls `setDisplayName` again
- **THEN** no second welcome email is sent
- **AND** the display-name update and redirect proceed as normal

### Requirement: One-time idempotency guard
The system SHALL persist a one-time marker on the user's profile (`profiles.welcome_email_sent_at`) recording when the welcome email was sent. The sender SHALL treat a non-null marker as "already sent" and MUST NOT send again. The marker SHALL be written only after the email provider accepts the message, so that a failed send leaves the marker null and the email MAY still be sent on a later successful onboarding action.

#### Scenario: Marker already set
- **WHEN** `setDisplayName` runs for a user whose `welcome_email_sent_at` is already non-null
- **THEN** no email is sent and no provider call is made

#### Scenario: Marker stamped on success
- **WHEN** the welcome email is accepted by the email provider
- **THEN** `profiles.welcome_email_sent_at` is set to the send time

#### Scenario: Send fails
- **WHEN** the email provider rejects or errors on the welcome send
- **THEN** `profiles.welcome_email_sent_at` remains null

### Requirement: Welcome email content orients the new user
The welcome email SHALL orient the new user to the three core loops of the product — the daily quiz, friend groups, and the leaderboard — and SHALL include a deep link into each, built from `env.siteUrl` and `localePath` (`/quiz`, `/groups`, `/leaderboard`). The email SHALL be rendered by a pure, dependency-free renderer that produces both an HTML part (email-safe table layout with inline styles and fixed hex colors, no `oklch`/`var()`/stylesheets) and a plain-text part, mirroring the `result-email-template.ts` pattern. All user-facing copy SHALL be supplied by the caller (no hardcoded strings in the renderer) and SHALL be resolved from a `welcomeEmail` i18n namespace present in `messages/{en,es,fr,de}.json`.

#### Scenario: Email renders the three loops with links
- **WHEN** the welcome email is rendered for a user
- **THEN** the HTML and text parts mention the daily quiz, friend groups, and the leaderboard
- **AND** each is linked to its localized in-app destination derived from `env.siteUrl`

#### Scenario: Personalized greeting
- **WHEN** the user has a display name
- **THEN** the email greeting includes that name
- **AND WHEN** no display name is available the renderer uses the name-less heading variant

### Requirement: Best-effort, non-blocking delivery
The welcome send SHALL be best-effort and MUST NOT block or break onboarding. If sending fails for any reason, the error SHALL be caught and logged, and the onboarding flow SHALL still update the display name and redirect to `/matches`. When `RESEND_API_KEY` is unset, the sender SHALL no-op (log and return) without attempting a send, leaving the idempotency marker unchanged.

#### Scenario: Provider error does not break onboarding
- **WHEN** the email provider throws or returns an error during the welcome send
- **THEN** the error is caught and logged
- **AND** `setDisplayName` still completes the display-name update and redirects to `/matches`

#### Scenario: Resend not configured
- **WHEN** `RESEND_API_KEY` is unset
- **THEN** the sender logs that it is skipping and returns without sending
- **AND** `profiles.welcome_email_sent_at` is left unchanged

#### Scenario: Recipient has no deliverable address
- **WHEN** the user's account email is missing or is an undeliverable/reserved domain
- **THEN** no email is sent and onboarding still completes normally
