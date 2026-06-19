## 1. Data: profiles.timezone column

- [x] 1.1 Add a Supabase migration under `supabase/migrations/` with a timestamped filename (e.g. `<YYYYMMDDHHMMSS>_profiles_timezone.sql`) adding nullable `timezone text` to `public.profiles` (no default).
- [x] 1.2 Document in the migration comment that the column holds a validated IANA zone, is written by the authenticated user's own row (existing owner RLS) and read by the service-role admin client in the crons (RLS bypass), and is purely additive.

## 2. Persist the user's timezone

- [x] 2.1 Add a server-side path that, for a signed-in request with a valid `tz` cookie (via the existing `tz` cookie read used by `/matches`), upserts the cookie value onto `profiles.timezone` when it differs from the stored value.
- [x] 2.2 Validate the cookie value with `isValidTimeZone` (`lib/match-utils.ts`) before writing; ignore absent/invalid cookies; skip the write when the value already matches.
- [x] 2.3 Make the write best-effort: wrap so any failure is caught and logged and never blocks or breaks page rendering (mirror the self-healing posture of `components/timezone-sync.tsx`).

## 3. Bucketing helper (pure)

- [x] 3.1 Add a pure helper that computes a user's current local hour from an IANA zone using `Intl.DateTimeFormat({ timeZone, hour: "2-digit", hourCycle: "h23" })` (same primitive family as `localDateKey`), falling back to the UTC hour when the zone is null/invalid per `isValidTimeZone`.
- [x] 3.2 Add an exported, unit-testable function over `(recipients, now)` that returns only the recipients whose current local hour equals the target hour (7), mirroring the existing `computePending*` helpers.

## 4. Dispatcher wiring — prediction reminders

- [x] 4.1 In `lib/notifications/prediction-reminder-emails.ts`, add `timezone` to the `loadOptedInProfiles` select and carry it on the recipient shape.
- [x] 4.2 Apply the local-7am bucketing filter to the recipient set inside `dispatchPredictionReminders` (after opt-in load, before/with the existing pending computation), leaving pagination, batching, ledger upsert, the `RESEND_API_KEY` no-op, and the summary semantics unchanged.

## 5. Dispatcher wiring — quiz reminders

- [x] 5.1 In `lib/notifications/quiz-reminder-emails.ts`, add `timezone` to the `loadOptedInProfiles` select and carry it on the recipient shape.
- [x] 5.2 Apply the same local-7am bucketing filter inside `dispatchQuizReminders`, leaving the `force` re-send path, ledger upsert, no-op, and summary semantics unchanged.

## 6. Cron schedule

- [x] 6.1 In `vercel.json`, change `/api/cron/prediction-reminders` and `/api/cron/quiz-reminders` from their fixed daily times to hourly (`0 * * * *`); leave `sync-matches` and `sync-news` unchanged.
- [x] 6.2 Confirm the cron routes still authorize via `CRON_SECRET`, wrap dispatch in `recordRun`, and return the zero summary on error (no route-contract change).

## 7. Verification

- [x] 7.1 Run typecheck (`tsc --noEmit` / project typecheck script) — no errors.
- [x] 7.2 Run lint — no new violations.
- [x] 7.3 Add/run unit tests for the pure bucketing helper: a user is bucketed at their local 7am across several zones (e.g. `America/New_York`, `Europe/Madrid`, `Asia/Tokyo`); a null/invalid timezone buckets to UTC 7am; users outside 7am are excluded.
- [x] 7.4 Add/run unit tests confirming dispatch invariants hold under bucketing: already-reminded users (in the day's ledger) are still skipped, opted-out users are excluded, and the `RESEND_API_KEY`-unset path still no-ops.
- [x] 7.5 Manual check: with `RESEND_API_KEY` set and `EMAIL_FROM` a verified-domain sender, trigger a reminder cron at a UTC hour matching a seeded user's local 7am and confirm exactly one email arrives; trigger again the same day and confirm no second email (ledger dedup).
- [x] 7.6 Confirm the `EMAIL_FROM` prod dependency (análisis.md QW1) and the UTC-fallback behavior (users without a stored timezone) are noted for deployment.
