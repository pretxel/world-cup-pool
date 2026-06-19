## Why

The prediction and quiz reminder emails are the product's main retention nudge, but they fire from a single daily UTC cron: `/api/cron/prediction-reminders` at `12:00 UTC` and `/api/cron/quiz-reminders` at `13:00 UTC` (`vercel.json`). análisis.md flags this as the core weakness of the nudge engine — "el motor de nudges depende casi exclusivamente del email batch diario en horario UTC fijo… sin segmentación por zona horaria. El recordatorio llega desacoplado del momento de uso real" (intro) — and as medium bet **M6**: *"Segmentar recordatorios por zona horaria (≈7am local)"* so the nudge lands when the user is awake and likely to act. Today a player in the Americas gets the email while asleep and misses the window (friction #3: "usuarios en América despiertan horas después del disparo").

We already store the visitor's IANA timezone in the `tz` cookie (written client-side by `components/timezone-sync.tsx`, read server-side by `lib/timezone.ts` `readTimeZoneCookie`), and `lib/match-utils.ts` already validates zones and derives local day keys (`isValidTimeZone`, `localDateKey`, `dayKeyForTimeZone`). The dispatchers are already idempotent per user per day via their `*_reminder_log` ledgers. So the change is mostly: persist each user's timezone on `profiles`, run the reminder crons hourly, and email each user only on the run nearest 7am in their own zone — reusing the existing eligibility, batching, and dedup logic.

## What Changes

- Add a nullable `profiles.timezone text` column (Supabase migration) holding a validated IANA zone, populated from the existing `tz` cookie / client timezone.
- Persist the timezone server-side: when a signed-in request carries a valid `tz` cookie that differs from the stored value, upsert it onto the user's `profiles.timezone` (best-effort, never blocking the page). The client `tz` cookie write (`components/timezone-sync.tsx`) stays the source of detection.
- Change both reminder crons from one fixed daily UTC time to **hourly** (`vercel.json`): `/api/cron/prediction-reminders` and `/api/cron/quiz-reminders` run at the top of every hour.
- Add a per-user **local-7am bucketing** gate to the dispatch path: on each hourly run, a user is eligible only when the current run's hour equals ~7am in that user's `profiles.timezone`. Users with no stored timezone fall back to a fixed UTC reference hour so nobody silently stops receiving reminders.
- Keep idempotency unchanged: the existing `prediction_reminder_log` (`user_id, reminder_date`) and `quiz_reminder_log` (`user_id, question_id`) ledgers already guarantee at-most-once per user per day, so an hourly cron that re-evaluates everyone never double-sends.

Non-goals: push notifications or in-app toasts (análisis.md big bets / section D), changing email copy/content, per-user configurable send time (it is fixed at ~7am local), the result email or comeback/digest emails, or any change to the existing opt-out / `email_prefs` model.

## Capabilities

### New Capabilities
- `timezone-segmented-reminders`: persist each user's timezone on their profile and run the prediction + quiz reminder crons hourly so each user is emailed on the run nearest 7am in their own timezone, reusing the existing eligibility and per-day dedup.

### Modified Capabilities

## Impact

- **Cron schedule**: `vercel.json` — `/api/cron/prediction-reminders` and `/api/cron/quiz-reminders` change from `0 12 * * *` / `0 13 * * *` to hourly (`0 * * * *`).
- **Cron routes**: `app/api/cron/prediction-reminders/route.ts` and `app/api/cron/quiz-reminders/route.ts` — unchanged auth/`recordRun`/zero-summary contract; they continue to call the dispatchers, which now apply the local-7am gate per run.
- **Lib (dispatch)**: `lib/notifications/prediction-reminder-emails.ts` and `lib/notifications/quiz-reminder-emails.ts` — `loadOptedInProfiles` also selects `timezone`; a new pure helper filters the recipient set to those for whom the current run hour is ~7am local (UTC fallback when timezone is null/invalid). Existing pagination, batching, ledger upsert, and summary semantics are unchanged.
- **Lib (timezone)**: reuse `lib/match-utils.ts` `isValidTimeZone` and an `Intl.DateTimeFormat`-based local-hour computation (same primitives as `localDateKey`); add a small helper to compute a user's current local hour from an IANA zone.
- **Timezone persistence**: a server-side path (e.g. extending the existing `tz`-cookie read used by `/matches`, or a tiny server action invoked alongside `TimezoneSync`) writes a validated `tz` to `profiles.timezone` for the signed-in user. Best-effort, never blocks rendering.
- **Data**: one new nullable column `profiles.timezone text` (Supabase migration), validated as an IANA zone before persistence; written via the authenticated user's own row (or the service-role admin client). No change to the `*_reminder_log` ledgers.
- **Dependency / caveat**: deliverability still depends on `EMAIL_FROM` being a Resend verified-domain sender in production (análisis.md QW1); with `RESEND_API_KEY` unset the dispatch no-ops as today. Bucketing also depends on a stored timezone — until a user's profile timezone is populated they receive reminders on the UTC fallback hour, not 7am local.
