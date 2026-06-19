## Why

The email retention engine can silently degrade in production with no signal. `lib/env.ts:46` falls back to the Resend sandbox sender `World Cup Pools <onboarding@resend.dev>` whenever `EMAIL_FROM` is unset — a sender that hurts deliverability and brand trust and can land reminders/result emails in spam. Separately, when `RESEND_API_KEY` is unset, every dispatcher (`result-emails.ts`, `prediction-reminder-emails.ts`, `quiz-reminder-emails.ts`) no-ops with only a `console.log` and returns a zero summary, so a misconfigured prod deploy looks identical to "nothing to send." This is quick win QW1 / friction #1 in `análisis.md`: the misconfig is real and verified, and today it fails silently.

This change adds detection and observability so the misconfiguration is caught — a clear warning at runtime and a flag in the dispatch summary that surfaces through the cron logs and the operations record — instead of quietly shipping a degraded email engine. It deliberately does NOT change the actual env values or the sandbox default; setting `EMAIL_FROM`/`RESEND_API_KEY` in prod remains an ops task.

## What Changes

- Add a pure helper (e.g. `checkEmailSenderConfig()` in `lib/notifications/`) that, given the current env, reports whether the production email sender is misconfigured: `EMAIL_FROM` still resolves to the sandbox default `onboarding@resend.dev`, and/or `RESEND_API_KEY` is missing. It classifies severity only in production (`process.env.NODE_ENV === "production"`).
- Emit a clear, single-line warning (`console.warn`) from the email dispatchers when the guard detects a production misconfiguration, instead of the current silent `console.log` no-op, so the problem is visible in cron logs.
- Surface the misconfiguration in the dispatch summary so it propagates through `recordRun` into the operations record / control room — adding a boolean/string flag (e.g. `senderMisconfigured` / `senderWarning`) alongside the existing `emailed`/`failed`/`skipped` counts without changing those counts' meaning.
- Document the required production configuration (`EMAIL_FROM` with a Resend verified-domain sender, `RESEND_API_KEY`) and the warning's meaning so an operator can act on it.

## Capabilities

### New Capabilities
- `email-sender-prod-guard`: A runtime guard that detects and surfaces production email-sender misconfiguration — sandbox `EMAIL_FROM` default and/or missing `RESEND_API_KEY` — via a clear warning and a dispatch-summary flag, so degraded deliverability is observable instead of silent.

### Modified Capabilities
<!-- None at the spec level. The existing email dispatchers gain a warning + a summary flag, but no current capability spec changes its requirements; send/idempotency/no-op behavior is unchanged. -->

## Impact

- **New helper**: `checkEmailSenderConfig()` (e.g. `lib/notifications/email-sender-config.ts`), pure and unit-testable, reading `env.emailFrom` / `env.resendApiKey` plus `NODE_ENV`.
- **Dispatchers**: `lib/notifications/result-emails.ts`, `prediction-reminder-emails.ts`, and `quiz-reminder-emails.ts` call the guard and `console.warn` on a production misconfiguration; they include the flag in their returned `DispatchSummary`.
- **Summary shape**: `DispatchSummary` (shared across the three dispatchers) gains an optional misconfiguration flag; `recordRun` / the operations record carry it through unchanged otherwise.
- **Cron routes**: `app/api/cron/prediction-reminders` and `quiz-reminders` already log the summary as JSON, so the flag appears in cron logs with no route changes required (result emails dispatch from their own path / admin force path).
- **Docs**: a short note (README or ops doc) on the required prod env and what the warning means.
- No schema changes, no new dependencies, no change to env values or the existing sandbox default.
