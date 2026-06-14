## Why

Magic-link sign-in is the only way into the app, but the email that carries the link is sent by self-hosted Supabase GoTrue through its built-in SMTP — which in this deployment points at the Inbucket fake-mail server. In practice that means production magic links are unbranded at best and undeliverable at worst, so new players can't reliably log in. We already send branded, deliverable transactional mail (result standings) through Resend with an email-safe template and next-intl copy; the login email should ride the same rails.

## What Changes

- Route Supabase Auth's magic-link email through a **Send Email Hook**: an authenticated Next.js route handler that GoTrue calls instead of sending the email itself.
- Add a **branded magic-link email template** that mirrors the app's visual language (pitch-green header, cream body, `WC·26·POOL` wordmark, mono uppercase labels) — built with the same email-safe HTML approach as the result-standing template, and localized via next-intl.
- The hook constructs the verification link from the hook payload (`token_hash` + `redirect_to`) so the existing `/auth/callback` flow keeps working unchanged.
- Verify each hook request with the Standard Webhooks HMAC signature so only GoTrue can trigger sends.
- Gracefully handle other auth email action types (recovery, email change) the hook may receive, since the Send Email Hook is all-or-nothing once enabled — render a branded fallback rather than dropping them.
- Wire configuration for both runtimes: `[auth.hook.send_email]` in `supabase/config.toml` (local CLI) and `GOTRUE_HOOK_SEND_EMAIL_*` in the self-hosted docker compose, plus document the new `SEND_EMAIL_HOOK_SECRET` env var.
- No change to the client `sign-in-form.tsx` — it keeps calling `signInWithOtp`.

## Capabilities

### New Capabilities
- `magic-link-email`: Branded magic-link (and related auth) emails delivered via Resend through a verified Supabase Send Email Hook, including the email template, link construction, signature verification, localization, and env-gated no-op behavior.

### Modified Capabilities
<!-- None. No existing spec's requirements change; the client sign-in flow and the result-email capability are untouched. -->

## Impact

- **New code**: a Send Email Hook route handler (e.g. `app/api/auth/send-email/route.ts`) and a `magic-link-email-template` renderer alongside the existing `result-email-template.ts`.
- **Config**: `supabase/config.toml` (`[auth.hook.send_email]`), `docker/docker-compose.yml` + `docker/.env.example` (`GOTRUE_HOOK_SEND_EMAIL_ENABLED/URI/SECRETS`), `.env.example` and `lib/env.ts` (`SEND_EMAIL_HOOK_SECRET`, plus the existing `RESEND_API_KEY` / `EMAIL_FROM`).
- **Dependencies**: reuses the already-installed `resend` SDK; adds `standardwebhooks` for signature verification.
- **i18n**: new `email.magicLink.*` message keys across locale files (en/es/fr).
- **Behavior**: production magic links become deliverable and on-brand; the hook no-ops the Resend call (returns success without sending, falling back to nothing) when `RESEND_API_KEY` is unset, mirroring the result-email dispatch gating.
- **Deliverability**: requires a Resend verified-domain `EMAIL_FROM` in production (currently unset — see the prod-email-sender note), otherwise only the sandbox sender works.
