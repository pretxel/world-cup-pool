# magic-link-email

## Purpose

Deliver Supabase Auth magic-link sign-in emails (and other auth action emails) through a Send Email Hook to an application endpoint that renders branded, localized, email-safe templates and sends them via Resend, rather than relying on GoTrue's built-in SMTP sender. The hook authenticates requests via Standard Webhooks, degrades gracefully when email is unconfigured, and is configured for both the local Supabase CLI and self-hosted GoTrue runtimes, while leaving the existing client sign-in and `/auth/callback` flow unchanged.

## Requirements

### Requirement: Magic-link email delivered via Resend through a Send Email Hook

The system SHALL deliver Supabase Auth magic-link sign-in emails by routing them through a Send Email Hook to an application endpoint that sends the email via Resend, instead of GoTrue's built-in SMTP sender. The client sign-in flow SHALL remain unchanged: it continues to call `signInWithOtp`, and the existing `/auth/callback` handler continues to complete sign-in.

#### Scenario: Magic-link request triggers a Resend send
- **WHEN** a user submits their email on the sign-in form and GoTrue calls the Send Email Hook with `email_action_type` `magiclink`
- **THEN** the hook endpoint renders the branded magic-link email and sends it to the user's address via Resend
- **AND** GoTrue does not send the email through its built-in SMTP server

#### Scenario: Link completes sign-in through the existing callback
- **WHEN** the recipient clicks the link in the delivered email
- **THEN** the link resolves through `/auth/v1/verify` and redirects to the `redirect_to` URL (`…/auth/callback`)
- **AND** the existing callback exchanges the code for a session and signs the user in

### Requirement: Verification link constructed from the hook payload

The hook SHALL construct the verification URL from the hook payload's `email_data`, using the public Supabase auth URL as the base and the `token_hash`, `email_action_type`, and `redirect_to` fields as query parameters.

#### Scenario: URL is built from payload fields
- **WHEN** the hook receives `email_data` with `token_hash`, `email_action_type`, and `redirect_to`
- **THEN** the action link is `${SUPABASE_PUBLIC_URL}/auth/v1/verify?token=<token_hash>&type=<email_action_type>&redirect_to=<redirect_to>`
- **AND** the base URL is the public Supabase/auth URL, not the frontend `site_url`

### Requirement: Branded, email-safe template matching the app

The magic-link email SHALL be rendered with the app's visual language — pitch-green header band, cream body, the `WC·26·POOL` wordmark, and mono uppercase labels — consistent with the existing result-standing email. The renderer SHALL be a pure, dependency-free function returning subject, HTML, and plain-text parts.

#### Scenario: Branded HTML is produced
- **WHEN** the magic-link email is rendered
- **THEN** the HTML uses a table layout with inline styles and fixed hex colors (no `oklch`, CSS variables, or external stylesheets)
- **AND** it includes the `WC·26·POOL` wordmark header and a primary call-to-action button linking to the verification URL

#### Scenario: Plain-text alternative is included
- **WHEN** the magic-link email is sent
- **THEN** a plain-text part mirroring the link and key copy is included for non-HTML clients

#### Scenario: User-provided content is escaped
- **WHEN** the template renders any value derived from user or request data
- **THEN** the value is HTML-escaped in the HTML part

### Requirement: Localized email copy

The email copy SHALL be resolved through next-intl from the `email` message namespace, consistent with the result-standing email, with keys added for every supported locale (en, es, fr).

#### Scenario: Copy resolves from translations
- **WHEN** the hook renders the email
- **THEN** subject, heading, body, CTA label, and footer come from next-intl message keys
- **AND** the keys exist for en, es, and fr locales

### Requirement: Authenticated hook requests

The hook endpoint SHALL verify the authenticity of each request using the Standard Webhooks signature scheme and the shared `SEND_EMAIL_HOOK_SECRET`. Requests that fail verification SHALL be rejected and no email SHALL be sent.

#### Scenario: Valid signature is accepted
- **WHEN** a request arrives with a valid Standard Webhooks signature for the configured secret
- **THEN** the request is processed and the email is sent

#### Scenario: Invalid or missing signature is rejected
- **WHEN** a request arrives with a missing or invalid signature
- **THEN** the endpoint responds with `401` and sends no email

#### Scenario: Signature is verified over the raw body
- **WHEN** the endpoint verifies the signature
- **THEN** it verifies against the exact raw request body bytes (not a re-serialized parsed object)

### Requirement: Safe handling of all auth email action types

Because the Send Email Hook receives every auth email type once enabled, the endpoint SHALL handle non-`magiclink` action types without crashing or blocking GoTrue. Link-bearing types SHALL be rendered with the branded action template; unknown or notification-only types SHALL return a success response rather than an error.

#### Scenario: Recovery or email-change type is rendered
- **WHEN** the hook receives a link-bearing `email_action_type` such as `recovery`, `invite`, `signup`, or `email_change`
- **THEN** the branded action email is rendered with type-appropriate copy and sent

#### Scenario: Unknown action type does not block auth
- **WHEN** the hook receives an `email_action_type` it does not explicitly handle
- **THEN** the endpoint returns a success response and does not error

### Requirement: Env-gated graceful degradation

The hook endpoint SHALL no-op safely when email sending is not configured, so a missing Resend key does not block authentication. When `RESEND_API_KEY` is unset the endpoint SHALL return success without attempting a send.

#### Scenario: Missing Resend key does not block auth
- **WHEN** the hook is invoked while `RESEND_API_KEY` is unset
- **THEN** the endpoint logs that sending is skipped and returns a success response without sending

### Requirement: Configuration for local and self-hosted runtimes

The change SHALL configure the Send Email Hook in both runtimes: the local Supabase CLI via `supabase/config.toml` and the self-hosted GoTrue via docker compose environment variables, and SHALL document the required environment variables.

#### Scenario: Local CLI config present
- **WHEN** the project runs under the local Supabase CLI
- **THEN** `supabase/config.toml` contains an `[auth.hook.send_email]` block with `enabled`, `uri`, and `secrets`

#### Scenario: Self-hosted config present
- **WHEN** the project runs under self-hosted docker GoTrue
- **THEN** the auth service is configured with `GOTRUE_HOOK_SEND_EMAIL_ENABLED`, `GOTRUE_HOOK_SEND_EMAIL_URI`, and `GOTRUE_HOOK_SEND_EMAIL_SECRETS`
- **AND** `SEND_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`, and `EMAIL_FROM` are documented in `.env.example`
