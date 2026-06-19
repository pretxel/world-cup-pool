## Context

Onboarding's `setDisplayName` server action (`app/[locale]/onboarding/actions.ts`) validates a display name, updates `profiles.display_name` for the authenticated user, revalidates the layout, and redirects to `/matches`. That redirect is the last guided moment in the new-user funnel; nothing afterward orients the player to the quiz, groups, or leaderboard.

The repo already has a mature transactional email pattern in `lib/notifications/`:

- A **pure renderer** (`result-email-template.ts`) builds email-safe HTML (table layout, inline styles, fixed hex palette mirroring the app's light theme, no `oklch`/`var()`/stylesheets) plus a plain-text part, with all copy passed in by the caller as a `*EmailStrings` object — keeping it unit-testable with no DB/network.
- A **server-only sender** (`result-emails.ts`, `quiz-reminder-emails.ts`) gates on `env.resendApiKey`, resolves the recipient's email from `auth.users` via the service-role admin client (`createAdminSupabaseClient`), builds localized strings via `getTranslations({ locale: DEFAULT_LOCALE, namespace })`, derives URLs from `env.siteUrl` + `localePath`, and sends through `new Resend(env.resendApiKey)` using `env.emailFrom`. Existing dispatchers send in batches; the welcome email is a single per-user send, so it uses `resend.emails.send` (one message) rather than `resend.batch.send`.

The welcome email is fundamentally simpler than the existing ones: no eligibility query, no pagination, no batch ledger — it fires once per user at a known moment. The only state it needs is a one-time guard.

## Goals / Non-Goals

**Goals:**
- Send exactly one welcome email per user, the first time they successfully set a display name in onboarding.
- Orient the new user to the three core loops — daily quiz, friend groups, leaderboard — with a deep link into each.
- Reuse the existing renderer/sender/Resend/i18n pattern with no new infrastructure or third-party dependency.
- Be best-effort: a send failure (or unset `RESEND_API_KEY`) must never break or delay the onboarding redirect to `/matches`.
- Be idempotent: re-running onboarding or editing a name later must not re-send.

**Non-Goals:**
- Marketing/broadcast email, digests, or re-engagement/comeback email.
- An in-app preference toggle or opt-out for the welcome email (it is a one-time transactional onboarding message, not a recurring campaign).
- Batching, pagination, or a per-recipient ledger table.
- Changing onboarding validation, UI, or the redirect target.

## Decisions

- **Trigger point:** call the sender inside `setDisplayName` after the `profiles` update succeeds and before `redirect("/matches")`. The send is awaited but fully wrapped so any rejection is swallowed and logged — `redirect` still runs. (Next's `redirect` throws control-flow internally, so the send must complete or be fire-and-safe before it; we keep it a short, guarded `await`.)
- **One-time guard via a timestamp column:** add `profiles.welcome_email_sent_at timestamptz` (nullable). The sender treats a non-null value as "already sent" and no-ops. This avoids a separate ledger table for a once-per-user event and reuses the `profiles` row the action already touches. An alternative — a dedicated `welcome_email_log` table like `result_email_log` — was rejected as overkill for a single, non-batched send.
- **Idempotency ordering:** stamp `welcome_email_sent_at = now()` only after Resend accepts the message, so a transient send failure leaves the stamp null and the email can be sent on a later successful onboarding action. To avoid a duplicate when two onboarding submits race, the sender re-checks the column is null (read-then-send-then-stamp); a tiny duplicate-send window is acceptable for a welcome email and far cheaper than a distributed lock.
- **Recipient email resolution:** reuse the `resolveEmail` pattern (admin `getUserById` → `user.email`) and the `isSendableEmail` guard from `result-emails.ts` so reserved/undeliverable domains are skipped rather than erroring.
- **Localization:** resolve copy from a new `welcomeEmail` namespace at `DEFAULT_LOCALE` (matching the other dispatchers, which all send at `DEFAULT_LOCALE` because the cron/admin contexts lack a request locale). Deep links use `localePath(DEFAULT_LOCALE, "/quiz" | "/groups" | "/leaderboard")` against `env.siteUrl`.
- **Sender identity:** use `env.emailFrom`. In production this must be a Resend verified-domain sender (see Risks); no per-message from-name override is needed.
- **No-op gating:** if `env.resendApiKey` is unset, log and return without sending — identical to `dispatchResultEmails`/`dispatchQuizReminders`.

## Risks / Trade-offs

- **`EMAIL_FROM` unset in prod (blocking dependency, análisis.md QW1).** `lib/env.ts:46` falls back to the sandbox sender `World Cup Pools <onboarding@resend.dev>`, which Resend only delivers to the account owner. Until `EMAIL_FROM` is a verified-domain sender, new users will not receive the welcome email even though the send "succeeds". Mitigation: document the dependency; the feature is otherwise complete and starts working the moment the env var is set.
- **`RESEND_API_KEY` unset (dev/staging).** The send no-ops silently. Acceptable and consistent with existing dispatchers; the guard column stays null so it sends once the key is configured.
- **Best-effort vs. guaranteed delivery.** Because the send is non-blocking and the stamp is only written on success, a brief Resend outage means some users never get the email (there is no retry cron). This is an intentional trade-off — a welcome email is not worth coupling to the onboarding success path or building a retry queue for the quick win.
- **Duplicate-send race.** Two concurrent onboarding submits could both read a null stamp and send twice. Window is small and the blast radius is one extra email; not worth a lock. Could be tightened later with a conditional update (`update ... where welcome_email_sent_at is null returning`) gating the send.
- **Locale mismatch.** Sending at `DEFAULT_LOCALE` may not match the user's chosen UI locale. Consistent with existing emails; revisiting locale propagation is out of scope here.
