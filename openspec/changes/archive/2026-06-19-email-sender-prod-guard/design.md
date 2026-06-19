## Context

`lib/env.ts` resolves email config once at module load: `resendApiKey: process.env.RESEND_API_KEY ?? null` (line 45) and `emailFrom: process.env.EMAIL_FROM ?? "World Cup Pools <onboarding@resend.dev>"` (line 46). The comment there already states `emailFrom` "must be a Resend verified-domain sender in production; the default is dev-only."

Three dispatchers consume this config and share an identical `DispatchSummary` shape (`{ emailed, failed, skipped }`):
- `lib/notifications/result-emails.ts` — cron path `dispatchResultEmails` and admin force path `forceDispatchResultEmails`.
- `lib/notifications/prediction-reminder-emails.ts` — `dispatchPredictionReminders`.
- `lib/notifications/quiz-reminder-emails.ts` — `dispatchQuizReminders`.

Each gates on `env.resendApiKey` at the top and, when unset, logs a single line (e.g. `console.log("[result-emails] RESEND_API_KEY unset — skipping dispatch")`) and returns a zero summary. The `from` address is built via `withFromName(env.emailFrom, fromName)`, which keeps the `<addr>` from env intact. The cron routes (`app/api/cron/prediction-reminders/route.ts`, `quiz-reminders/route.ts`) wrap dispatch in `recordRun(...)`, then `console.log` the summary as JSON and return it; `recordRun` (`lib/operations/record-run.ts`) persists every run and derives `success`/`partial` from `FAILURE_KEYS = ["errors", "failed"]` for the operations control room.

`process.env.NODE_ENV === "production"` is the production signal already used by the cron routes for their `missing-env` short-circuit, so the guard reuses it.

## Goals / Non-Goals

**Goals:**
- Detect, in production, when `emailFrom` still resolves to the sandbox `onboarding@resend.dev` default and/or `RESEND_API_KEY` is missing.
- Make that detection observable: a clear `console.warn` in the dispatchers and a flag in the dispatch summary that flows through `recordRun` to the operations record / cron logs.
- Keep the helper pure and unit-testable; keep existing send/idempotency/no-op behavior unchanged.

**Non-Goals:**
- Changing the env values, removing the sandbox default, or making the build/dispatch fail-fast/throw on misconfiguration (it must still no-op gracefully, exactly as today).
- Validating the email address syntactically or verifying the domain with Resend (out of scope; this is detection of the known defaults).
- Adding alerting/paging integrations, a UI badge, or analytics events (observability here = warning + summary flag + docs).
- Per-recipient or non-production warnings beyond an optional dev hint.

## Decisions

### Decision: A single pure guard helper keyed off env + NODE_ENV
Add `checkEmailSenderConfig()` returning a small result, e.g. `{ isSandboxSender, missingApiKey, isProduction, shouldWarn, message }`. `isSandboxSender` is true when `env.emailFrom` contains `onboarding@resend.dev` (matched on the address, not the display name, so a custom `fromName` doesn't mask it). `missingApiKey` is true when `env.resendApiKey` is null. `shouldWarn` is true only when `isProduction` and (`isSandboxSender` || `missingApiKey`). Pure + exported so it can be unit-tested without a database or live env.

*Alternative considered:* inline checks in each dispatcher — rejected; three copies drift, and a shared helper is the only place the "sandbox address" string and the prod rule live.

### Decision: `console.warn` (not throw, not silent) on production misconfiguration
On a production misconfiguration the dispatchers emit one clear `console.warn` line (replacing/augmenting the existing silent `console.log` no-op when the key is missing, and adding a new warn when the sandbox sender is in use with a key present). Throwing would break the graceful no-op contract and could trip cron alerting; staying silent is the current bug. A warning is the right altitude: visible in logs, non-fatal.

*Alternative considered:* fail the cron with a 500 — rejected; the routes deliberately isolate dispatch failures to avoid Vercel cron retry-storms.

### Decision: Carry the signal in `DispatchSummary`, not a new channel
Extend the shared `DispatchSummary` with an optional flag (e.g. `senderMisconfigured?: boolean` and/or a `senderWarning?: string`). Because the cron routes already `console.log(JSON.stringify(summary))` and pass it to `recordRun`, the flag automatically reaches cron logs and the operations record with no route edits. Keep `emailed`/`failed`/`skipped` semantics intact so `deriveStatus` (which keys off `failed`) is unaffected unless we choose to also let the flag influence status.

*Alternative considered:* a separate log table or a new return value — rejected; the summary is the established carrier and already observed.

### Decision: Apply the guard at the top of every dispatcher
Call the helper at the start of `dispatchResultEmails`, `forceDispatchResultEmails`, `dispatchPredictionReminders`, and `dispatchQuizReminders` — before the existing `resendApiKey` no-op return — so the missing-key case still warns and reports the flag even though it sends nothing, and the sandbox-sender case warns on every real send path.

## Risks / Trade-offs

- **Log noise**: a misconfigured prod warns on every run. Acceptable — that is the intent (loud until fixed); it is one line per run, not per recipient.
- **Sandbox-address match brittleness**: matching `onboarding@resend.dev` is a literal-string check. If Resend changes its sandbox address the check goes stale — mitigated by centralizing the constant in the helper and covering it with a test, and by also flagging the missing-key case which is independent.
- **Summary shape change ripples**: adding an optional field to the shared `DispatchSummary` touches three dispatchers and any summary consumers. Mitigated by making the field optional and leaving `emailed`/`failed`/`skipped` untouched, so `recordRun`/`deriveStatus` and existing tests keep passing.
- **False sense of safety**: the guard detects only the two known defaults, not every bad sender. Documented as such; domain verification stays an ops responsibility.
