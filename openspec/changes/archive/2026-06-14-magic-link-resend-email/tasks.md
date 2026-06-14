## 1. Dependencies & env

- [x] 1.1 Add `standardwebhooks` to `package.json` dependencies (Resend SDK already present)
- [x] 1.2 Add `sendEmailHookSecret` (nullable, from `SEND_EMAIL_HOOK_SECRET`) to `lib/env.ts`
- [x] 1.3 Document `SEND_EMAIL_HOOK_SECRET` in `.env.example` and confirm `RESEND_API_KEY` / `EMAIL_FROM` notes are accurate

## 2. Branded email template

- [x] 2.1 Create `lib/notifications/magic-link-email-template.ts` mirroring `result-email-template.ts` (shared `C` palette, `SANS`/`MONO`, `renderHeader()` wordmark, email-safe table layout, `escapeHtml`)
- [x] 2.2 Define `MagicLinkEmailStrings` + `MagicLinkEmailData` (actionUrl, action type, strings) and a pure `renderMagicLinkEmail(data)` returning `{ subject, html, text }` with HTML + plain-text parts and a CTA button
- [x] 2.3 Add `email.magicLink.*` message keys (subject, preheader, eyebrow, heading, intro, ctaLabel, footer, plus action-type variants) to en, es, and fr locale files

## 3. Send Email Hook endpoint

- [x] 3.1 Create `app/api/auth/send-email/route.ts` POST handler that reads the raw body with `req.text()`
- [x] 3.2 Verify the request with `standardwebhooks` `Webhook` using `SEND_EMAIL_HOOK_SECRET` (strip `v1,whsec_`); return `401` on failure with no send
- [x] 3.3 Build the action URL: `${env.supabaseUrl}/auth/v1/verify?token=<token_hash>&type=<email_action_type>&redirect_to=<redirect_to>`
- [x] 3.4 Resolve locale + strings via `getTranslations({ namespace: "email.magicLink" })`, render with `renderMagicLinkEmail`, and send via `resend.emails.send` using `env.emailFrom`
- [x] 3.5 Handle non-`magiclink` types: render branded copy for link-bearing types (`recovery`, `invite`, `signup`, `email_change`); return success (no-op) for unknown/notification-only types
- [x] 3.6 Env-gate: when `RESEND_API_KEY` is unset, log and return `200` without sending

## 4. Runtime configuration

- [x] 4.1 Add `[auth.hook.send_email]` block (`enabled`, `uri`, `secrets = "env(SEND_EMAIL_HOOK_SECRET)"`) to `supabase/config.toml`
- [x] 4.2 Add `GOTRUE_HOOK_SEND_EMAIL_ENABLED/URI/SECRETS` to the auth service in `docker/docker-compose.yml` and the keys to `docker/.env.example`

## 5. Tests

- [x] 5.1 Unit-test `renderMagicLinkEmail`: branded HTML (wordmark, CTA → action URL), plain-text part, and HTML-escaping of user/request-derived values
- [x] 5.2 Unit-test the action-URL builder for `magiclink` and a link-bearing alternate type
- [x] 5.3 Unit-test signature verification (valid signature accepted; invalid → 401) and the `RESEND_API_KEY`-unset no-op path

## 6. Verification

- [x] 6.1 Run `npm run lint`, typecheck, and `vitest` — lint 0 errors, tsc clean, 479 tests pass
- [ ] 6.2 Local end-to-end: enable hook in `config.toml`, request a magic link, confirm branded email in Inbucket and successful login through `/auth/callback` _(manual — needs running local Supabase + Next dev server)_
- [ ] 6.3 Prod readiness: confirm verified-domain `EMAIL_FROM`, `RESEND_API_KEY`, and `SEND_EMAIL_HOOK_SECRET` are set in Vercel + GoTrue, then send a real test link to the owner _(manual — needs prod secrets + GoTrue restart)_
