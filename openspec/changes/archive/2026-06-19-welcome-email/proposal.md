## Why

A new player's only guided touchpoint today is the onboarding screen that asks for a display name (`app/[locale]/onboarding/actions.ts` `setDisplayName`), which then redirects straight to `/matches`. After that the user is on their own — there is no message orienting them to the three core loops (the daily quiz, friend groups, and the leaderboard). análisis.md flags this as quick win **QW5**: a one-time welcome email post-onboarding orients the new user and triggers the first interaction. The infrastructure to send it already exists (`lib/notifications/`, the `result-email-template.ts` rendering pattern, Resend via `lib/env` `emailFrom`), so this is a low-effort/high-impact addition.

## What Changes

- When `setDisplayName` successfully sets a new user's display name, send a one-time, transactional welcome email that orients them to the quiz, groups, and the leaderboard, with deep links into each.
- Add a pure, dependency-free welcome email renderer (`lib/notifications/welcome-email-template.ts`) following the `result-email-template.ts` pattern: email-safe table HTML, fixed hex palette, an HTML + plain-text part, all copy passed in by the caller.
- Add a server-only sender (`lib/notifications/welcome-email.ts`) that resolves the user's auth email via the admin client, renders localized copy, and sends a single message through Resend using `env.emailFrom`.
- Make the send strictly one-time and best-effort: gate on a new `profiles.welcome_email_sent_at` timestamp so a re-run of onboarding (or a name edit) never re-sends, and never let an email failure break the onboarding redirect.
- Add a `welcomeEmail` i18n namespace to `messages/{en,es,fr,de}.json`.
- No-op silently when `RESEND_API_KEY` is unset (mirrors the existing dispatchers).

Non-goals: a generic broadcast/marketing email, re-engagement or digest emails, an in-app preferences toggle for this email, batching to many recipients, or changing the onboarding UI/flow itself.

## Capabilities

### New Capabilities
- `welcome-email`: send a one-time orientation email to a new user right after they set their display name during onboarding.

### Modified Capabilities

## Impact

- **App**: `app/[locale]/onboarding/actions.ts` — after the successful `profiles` update in `setDisplayName`, trigger the welcome send (best-effort, before the existing `redirect("/matches")`).
- **Lib**: new `lib/notifications/welcome-email-template.ts` (pure renderer) and `lib/notifications/welcome-email.ts` (server-only sender). Reuses `lib/env` `emailFrom`/`resendApiKey`, `lib/supabase/admin`, `lib/i18n` `DEFAULT_LOCALE`/`localePath`, and `getTranslations` exactly like `result-emails.ts`/`quiz-reminder-emails.ts`.
- **i18n**: new `welcomeEmail` namespace in `messages/{en,es,fr,de}.json`.
- **Data**: one new nullable column `profiles.welcome_email_sent_at timestamptz` (Supabase migration) used as the one-time idempotency stamp; written via the service-role admin client. No RLS change for end users.
- **Dependency / caveat**: deliverability depends on `EMAIL_FROM` being set to a Resend verified-domain sender in production (`lib/env.ts:46` otherwise falls back to the sandbox `World Cup Pools <onboarding@resend.dev>`, which only reaches the account owner) — this is análisis.md quick win **QW1** and a prerequisite for the welcome email to actually reach new users. With `RESEND_API_KEY` unset the send no-ops.
