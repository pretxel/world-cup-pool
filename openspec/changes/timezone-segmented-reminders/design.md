## Context

The two reminder dispatchers (`lib/notifications/prediction-reminder-emails.ts`, `lib/notifications/quiz-reminder-emails.ts`) share a mature shape: gate on `env.resendApiKey`; load the eligible set (today's open matches / today's active question); load opted-in profiles via `loadOptedInProfiles` (paginated, reading `email_prefs` through `isOptedIn`); subtract those already actioned (predicted/answered) and those already in the per-day ledger; resolve each recipient's email via the admin client; send in batches of ≤100 through `resend.batch.send`; and write the ledger row only after the provider accepts the batch. Idempotency is per user per UTC day: `prediction_reminder_log (user_id, reminder_date)` and `quiz_reminder_log (user_id, question_id)`. Both run from `recordRun`-wrapped cron routes that return a zero summary (never a 500) so a flaky run never trips Vercel's cron alerting.

Today both crons fire once at a fixed UTC time (`vercel.json`: `0 12 * * *`, `0 13 * * *`), so every recipient is emailed at the same instant regardless of where they live. The repo already detects and validates the visitor's IANA timezone: `components/timezone-sync.tsx` writes it to the `tz` cookie, `lib/timezone.ts` `readTimeZoneCookie` reads + validates it server-side, and `lib/match-utils.ts` already groups `/matches` by local day (`isValidTimeZone`, `localDateKey`, `dayKeyForTimeZone`). What is missing is (a) persisting that zone where a cron can read it — the cron has no request, hence no cookie — and (b) a per-run gate so a user is only emailed near 7am their time.

## Goals / Non-Goals

**Goals:**
- Email each user their existing prediction / quiz reminder on the run nearest **7am in their own timezone**, instead of one fixed UTC instant for everyone.
- Persist each user's timezone on `profiles.timezone`, populated from the same `tz` cookie / browser timezone the app already detects.
- Keep at-most-once-per-day delivery: an hourly cron that re-evaluates everyone must never double-send. Reuse the existing `*_reminder_log` ledgers unchanged.
- Reuse the existing eligibility, pagination, batching, and summary logic; add only a pure per-run bucketing filter and a `timezone` column to the profile select.
- Degrade safely: a user with no stored (or invalid) timezone still receives reminders, on a fixed UTC fallback hour.

**Non-Goals:**
- Push notifications, in-app toasts, or any new delivery channel (análisis.md big bets / section D).
- A user-configurable send time, or sending at any hour other than ~7am local.
- Changing email copy, the renderers, the opt-out / `email_prefs` model, or the result/comeback/digest emails.
- Sub-hourly precision: bucketing to the nearest whole hour is sufficient and matches Vercel cron granularity.

## Decisions

- **Persist timezone on `profiles`, not a new table.** Add nullable `profiles.timezone text` (Supabase migration, no default). The cron reads it during the existing `loadOptedInProfiles` select (add `timezone` to the column list). A dedicated table was rejected: this is one scalar per user, naturally part of the profile the app already touches.
- **Source of timezone = the existing `tz` cookie.** Detection stays client-side in `TimezoneSync` (unchanged). Persistence happens server-side for signed-in requests: when a valid `tz` cookie differs from `profiles.timezone`, upsert it. Reuse `isValidTimeZone` (`lib/match-utils.ts`) so a garbage cookie never lands in the column. Write is best-effort and must never block or break page rendering — same posture as `TimezoneSync`'s self-healing refresh.
- **Hourly crons (`vercel.json`).** Change both reminder crons to `0 * * * *`. The non-reminder crons (`sync-matches`, `sync-news`) are untouched. `maxDuration = 60` on the routes is unchanged; per-run work shrinks because each run only emails the ~1/24 of users currently at 7am.
- **Pure local-7am bucketing gate.** Add a helper that, given an IANA zone and "now", returns the user's current local hour (via `Intl.DateTimeFormat({ timeZone, hour: "2-digit", hourCycle: "h23" })`, the same primitive family as `localDateKey`). A user is eligible on a run when their local hour equals the target (7). Implement as a pure, exported, unit-testable function over `(profiles, now)` mirroring the existing `computePending*` helpers, so the dispatch wiring stays thin and the time logic is tested without a clock or network.
- **UTC fallback for missing/invalid timezone.** When `profiles.timezone` is null or fails `isValidTimeZone`, treat the user as being in UTC for bucketing — so they are emailed on the run where UTC hour == 7. This guarantees no opted-in user silently stops receiving reminders before their timezone is backfilled. (Chosen over "skip until known," which would mute brand-new or cookie-less users.)
- **Idempotency is already correct — no ledger change.** Both ledgers key on (user, day): `reminder_date` (UTC date) and `question_id` (one active question per UTC day). Once a user is emailed at their 7am, later hourly runs that same UTC day find them in the ledger and skip them. The only subtlety is the day boundary: a user whose local 7am falls on a different UTC date than "now" is still keyed by the dispatcher's UTC `reminder_date` — acceptable because the eligibility window (today's open matches / today's active question) and the ledger both use the same UTC day, so the at-most-once-per-day guarantee holds. Documented as a known edge (see Risks).
- **No change to the cron route contract.** Routes keep their `CRON_SECRET` auth, `recordRun` wrapping, and zero-summary-on-error behavior. They call the same dispatcher functions; bucketing lives inside dispatch so the admin re-send / `force` path (quiz) and `recordRun` summaries are unaffected.

### Migration / cron / realtime callouts

- **DB migration (required):** `supabase/migrations/<timestamp>_profiles_timezone.sql` — `alter table public.profiles add column timezone text;` (nullable, no default). Purely additive; no RLS change beyond the user being able to write their own row (profiles already has owner policies; the cron reads via the service-role admin client which bypasses RLS).
- **Cron (required):** `vercel.json` — both reminder crons move to `0 * * * *` (hourly). This increases invocation count ~24× but each run does far less work; well within Vercel cron limits.
- **Supabase Realtime:** not needed for this change.

## Risks / Trade-offs

- **Users without a stored timezone get the UTC fallback, not 7am local.** Until a signed-in user visits and their `tz` cookie is persisted, they are bucketed as UTC. Mitigation: persistence happens on normal authenticated page loads (where `tz` is already present), so the column backfills quickly through ordinary use; the fallback guarantees they keep getting reminders meanwhile.
- **24× more cron invocations.** Hourly runs mean both dispatchers wake every hour. Each run still does the full eligibility load (matches/question, profiles, ledger) but only sends to the ~1/24 of users at their 7am, so email volume is unchanged and per-run send/batch cost drops. The repeated reads are the cost; acceptable, and `recordRun` keeps each run observable. If read cost ever matters, the profile/ledger loads could be narrowed by timezone later.
- **DST / half-hour zones / day-boundary skew.** Bucketing to the nearest whole local hour means half-hour-offset zones (e.g. `Asia/Kolkata`) and DST-transition days can land a user at 6am or 8am rather than exactly 7am — a ≤1h drift, not a missed or duplicated send. The per-(user, UTC-day) ledger still prevents duplicates even if a user's local 7am and the UTC `reminder_date` fall on different calendar dates. Accepted: ~7am is the spec ("≈7am local"), and exact-minute precision is out of scope.
- **Empty hourly runs.** Most hours, the eligible-after-bucketing set is empty (no user at 7am, or no matches/active question), and the dispatcher returns its zero summary early — the same no-op path it already has for "no pending." No new failure mode.
- **`EMAIL_FROM` / `RESEND_API_KEY` (análisis.md QW1).** Unchanged dependency: with a sandbox sender only the owner is reached, and with no API key the dispatch no-ops. Bucketing changes *when*, not *whether*, deliverability is configured.
- **Cookie-only detection.** A user who blocks cookies or never loads a page client-side never persists a timezone and stays on the UTC fallback. Acceptable — same population that already gets UTC-grouped `/matches`.
