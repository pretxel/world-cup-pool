## Context

Sign-in is magic-link only: `sign-in-form.tsx` calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`, and the link lands on `app/auth/callback/route.ts` which runs `exchangeCodeForSession`. The email itself is produced and sent by self-hosted Supabase GoTrue. In this deployment GoTrue's SMTP points at the bundled `supabase-mail` (Inbucket) test server (`docker/.env.example`), so production magic-link emails are not actually delivered, and even where they are, they use GoTrue's default unbranded template.

We already operate a Resend-based transactional path for result-standing emails (`lib/notifications/result-emails.ts` + `result-email-template.ts`): an email-safe HTML renderer (table layout, inline styles, fixed hex equivalents of the app's oklch tokens, `WC·26·POOL` wordmark) fed by next-intl copy, env-gated to no-op when `RESEND_API_KEY` is unset, and covered by unit tests. The login email should reuse exactly this approach.

Constraints:
- The app runs on Vercel; Supabase (GoTrue) is self-hosted via `docker/`. The hook endpoint must be a publicly reachable HTTPS URL the GoTrue container can call.
- Email HTML must be client-safe: no `oklch`, no CSS variables, no external stylesheets.
- The existing `/auth/callback` `code`-exchange flow must keep working unchanged.

## Goals / Non-Goals

**Goals:**
- Deliver the magic-link sign-in email through Resend with branding that matches the app and the existing result email.
- Keep the client sign-in flow (`signInWithOtp`) and the `/auth/callback` handler untouched.
- Localize the email via next-intl, consistent with the result email.
- Verify hook authenticity so only GoTrue can trigger sends; env-gate so missing config degrades safely.
- Configure both runtimes (local CLI `config.toml` and self-hosted docker GoTrue).

**Non-Goals:**
- Replacing or restyling the web sign-in page UI.
- Building a full templating system for every conceivable auth email — only `magiclink` is first-class; other action types get a minimal branded fallback.
- Switching the auth flow away from magic link (no passwords, OAuth, or OTP-code entry).
- Email open/click analytics.

## Decisions

### Decision 1: Use the Supabase Send Email Hook, not custom SMTP

**Choice:** Enable Supabase Auth's **Send Email Hook**, pointing at a Next.js route handler (`app/api/auth/send-email/route.ts`) that renders a branded template and sends via the Resend SDK.

**Why:** It gives full template control *in the repo* — we reuse the `result-email-template.ts` palette and wordmark, localize with next-intl, and unit-test the renderer exactly as we do today. It rides the already-installed `resend` dependency and the established env-gating pattern.

**Alternative considered — Custom SMTP (Resend SMTP) + GoTrue template files:** Point GoTrue's SMTP at `smtp.resend.com` and customize the magic-link template via `content_path` (config.toml) / mounted template files + `MAILER_TEMPLATES_MAGIC_LINK` (self-hosted). Rejected: branding lives in Go-template HTML files outside our component/i18n system, can't reuse the result-email renderer, has no clean next-intl localization, and splits "how email looks" across two stacks. The hook keeps everything in TypeScript and tested.

### Decision 2: Construct the verification link from the hook payload

GoTrue POSTs `{ user, email_data }` where `email_data` includes `token_hash`, `email_action_type`, `redirect_to`, and `site_url`. The hook builds the link as:

```
${SUPABASE_PUBLIC_URL}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}
```

The base is the **public Supabase/auth URL** (`env.supabaseUrl`, i.e. the browser-facing `NEXT_PUBLIC_SUPABASE_URL` / Kong external URL) — not `site_url`, which is the frontend origin. Hitting `/auth/v1/verify` lets GoTrue complete verification and redirect to `redirect_to`, which is already `…/auth/callback`, so the existing `exchangeCodeForSession` handler is reused with no change.

### Decision 3: Verify the hook with Standard Webhooks (HMAC)

GoTrue signs hook requests per the Standard Webhooks spec. The handler verifies with the `standardwebhooks` package and the shared secret `SEND_EMAIL_HOOK_SECRET` (format `v1,whsec_<base64>`):

```ts
const wh = new Webhook(secret.replace("v1,whsec_", ""));
const { user, email_data } = wh.verify(rawBody, headers);
```

A failed verification returns `401` and sends nothing. The raw request body must be read with `await req.text()` (not `req.json()`) because signature verification is over the exact bytes.

### Decision 4: Branded renderer, parallel to the result email

Add `lib/notifications/magic-link-email-template.ts` mirroring `result-email-template.ts`: same `C` palette, `SANS`/`MONO` fonts, `renderHeader()` wordmark, email-safe table layout, and an `escapeHtml` discipline. It exposes a pure `renderMagicLinkEmail(data)` → `{ subject, html, text }` taking a `MagicLinkEmailStrings` (next-intl copy) plus the `actionUrl`. Pure and dependency-free, so it is unit-testable like the result template. The route handler resolves the locale (default locale; optionally honor a `redirect_to` locale segment), builds strings via `getTranslations({ namespace: "email" })`, renders, and calls `resend.emails.send`.

### Decision 5: All-or-nothing hook — handle non-magiclink types gracefully

Once enabled, the Send Email Hook receives *every* auth email type (`recovery`, `email_change`, the `*_notification` types, etc.), not just `magiclink`. The app today only triggers `magiclink`, but the handler MUST NOT crash or silently drop others. It renders the branded action template for link-bearing types (`magiclink`, `recovery`, `invite`, `signup`, `email_change`) with type-appropriate copy, and for notification-only types either sends a minimal branded notice or returns success without sending. Unknown types return success (no-op) rather than erroring, so GoTrue isn't blocked.

### Decision 6: Env-gating and config surface

- `lib/env.ts`: add `sendEmailHookSecret` (nullable). Reuse existing `resendApiKey` / `emailFrom`.
- If `RESEND_API_KEY` is unset, the handler logs and returns `200` without sending (mirrors result-email dispatch no-op) so local/dev GoTrue isn't blocked.
- Local CLI (`supabase/config.toml`):
  ```toml
  [auth.hook.send_email]
  enabled = true
  uri = "http://host.docker.internal:3000/api/auth/send-email"
  secrets = "env(SEND_EMAIL_HOOK_SECRET)"
  ```
- Self-hosted (`docker/docker-compose.yml` auth service + `docker/.env.example`):
  ```
  GOTRUE_HOOK_SEND_EMAIL_ENABLED=true
  GOTRUE_HOOK_SEND_EMAIL_URI=https://world-cup-pool-sepia.vercel.app/api/auth/send-email
  GOTRUE_HOOK_SEND_EMAIL_SECRETS=v1,whsec_<base64>
  ```
- Document `SEND_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` in `.env.example`.

## Risks / Trade-offs

- **EMAIL_FROM unverified in prod** → Resend sandbox sender only reaches the project owner, so real users won't receive links. Mitigation: ship requires setting a Resend verified-domain `EMAIL_FROM` (called out in tasks; tracked by the existing prod-email-sender note).
- **Hook endpoint unreachable from GoTrue** (network/URL wrong) → all auth emails fail. Mitigation: use the public Vercel URL; verify end-to-end after deploy; keep the dev no-op so a missing key doesn't wedge local auth.
- **Signature verification over parsed body** is a classic bug → read `req.text()` and pass raw bytes to `wh.verify`. Covered by a unit test with a known good/bad signature.
- **All-or-nothing hook silently swallows an unhandled type** → users of a future flow (password recovery) get no email. Mitigation: explicit branded handling for all link-bearing types now; log unknown types.
- **Rate limits**: `[auth.rate_limit].email_sent = 2/hour` plus Resend limits. Mitigation: unchanged from today; document but don't alter.
- **Latency/availability**: GoTrue now depends on the Vercel function being up to send any auth email. Mitigation: handler is thin; failures return clear status codes; consider monitoring later (out of scope).

## Migration Plan

1. Land code (handler + template + i18n + env) behind disabled hook config — no behavior change.
2. Set `SEND_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`, verified `EMAIL_FROM` in Vercel and the GoTrue env.
3. Enable the hook in self-hosted GoTrue (`GOTRUE_HOOK_SEND_EMAIL_ENABLED=true`) / `config.toml` and restart auth.
4. Send a test magic link to the owner; confirm branded delivery and successful login through `/auth/callback`.
5. **Rollback:** set `GOTRUE_HOOK_SEND_EMAIL_ENABLED=false` (or disable in config) and restart — GoTrue reverts to built-in SMTP sending immediately; no code rollback needed.

## Open Questions

- Should the email be localized per-user (from a locale hint in `redirect_to`) or always default locale? Default-locale is the v1 assumption; per-locale is a cheap follow-up if `redirect_to` carries `/[locale]/`.
- Do we also want a branded template for `recovery`/`email_change` copy now, or only `magiclink` first-class with a generic fallback for the rest? Proposal assumes magiclink-first with a safe fallback.
