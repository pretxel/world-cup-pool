## Context

The app already ships a daily quiz reminder email (`lib/notifications/quiz-reminder-emails.ts`, cron `app/api/cron/quiz-reminders/route.ts`, template, unsubscribe route, `quiz_reminder_log` ledger, `profiles.quiz_reminder_opt_out`). This change adds a parallel reminder for the core action — score predictions — and deliberately mirrors that proven pattern rather than inventing a new one.

Relevant existing building blocks:
- `predictions` table: `(user_id, match_id, home_goals, away_goals, submitted_at)`, unique on `(user_id, match_id)`.
- `matches` table: `(id, home_team, away_team, kickoff_at, status, stage, group_code, competition_id)`; `status ∈ {scheduled, live, final, cancelled}`.
- `lib/match-utils.ts`: `isLocked`/`lockReason` (locked when final/cancelled/live or past kickoff), `isConfirmedMatch` (both teams resolve to a flag), `needsPick`.
- Email plumbing: Resend `batch.send` (≤100/call), `env` (`resendApiKey`, `emailFrom`, `siteUrl`, `cronSecret`), `createAdminSupabaseClient()`, `getActiveBranding().emailFromName`, `withFromName`, `getUserById` for addresses, `List-Unsubscribe` headers, `DEFAULT_LOCALE` + `localePath`.
- Cron: declared in `vercel.json`; Bearer `CRON_SECRET` auth; `maxDuration = 60`.

## Goals / Non-Goals

**Goals:**
- Remind opted-in players, once per day, of today's confirmed open matches they have not yet predicted.
- Be idempotent across same-day cron retries; never double-send.
- Independent opt-out from the quiz reminder, with one-click unsubscribe.
- Localized (en/es/fr) email listing the pending fixtures.

**Non-Goals:**
- Per-user timezone personalization of "today" (sender has no request context; see Decisions).
- Per-user send-time preferences or digesting across multiple days.
- Changing prediction submission or lock rules.
- Push/in-app notifications (email only, this change).

## Decisions

### Mirror the quiz-reminder architecture
Add `lib/notifications/prediction-reminder-emails.ts` (`dispatchPredictionReminders(fromName)` → `DispatchSummary`) and `lib/notifications/prediction-reminder-template.ts` (pure renderer), a cron route at `app/api/cron/prediction-reminders/route.ts`, and an unsubscribe route at `app/api/prediction-reminders/unsubscribe/route.ts`. Keep the pure/eligibility helpers exported for unit tests, exactly as the quiz module does.
*Alternative considered:* generalize both into one "reminders" engine. Rejected — premature abstraction over two concrete, simple jobs; the quiz feature is shipped and stable.

### Define "today" as a UTC date window
Select today's matches as `kickoff_at >= todayUTC 00:00Z AND kickoff_at < tomorrowUTC 00:00Z`, consistent with the quiz reminder's `todayUtcDate()`. The matches list personalizes day grouping by the visitor's `tz` cookie, but a cron has no visitor, so a deterministic UTC window is the simplest correct choice.
*Alternative considered:* a fixed tournament timezone (WC 2026 is North America). Rejected for now — adds config with little benefit; revisit if players report off-by-one-day reminders. Captured in Open Questions.

### Eligibility composed in code from bulk reads
Load, with pagination (PostgREST caps ~1000 rows/page) and concurrently: opted-in profiles, today's confirmed open matches, and the set of `(user_id, match_id)` predictions for those matches. Then, per player, compute pending = today's open matches minus that player's predicted match ids; players with an empty pending set are skipped. This avoids N+1 queries and mirrors the quiz module's `loadOptedInProfiles` + exclusion-set approach.

### Per-day idempotency via a date-keyed ledger
New table `prediction_reminder_log (user_id uuid, reminder_date date, sent_at timestamptz default now())`, PK `(user_id, reminder_date)`. Exclude players already in the ledger for today; upsert ledger rows only for batches Resend accepted (`onConflict: "user_id,reminder_date", ignoreDuplicates: true`). The quiz ledger keys on `question_id` (one question/day); predictions have many matches/day, so the natural key is the **date**, not a match — a player is reminded once for the whole day's slate.

### Dedicated opt-out column
Add `profiles.prediction_reminder_opt_out boolean not null default false`. Reuse the existing `unsubscribe_token` (one opaque token per profile) for the new unsubscribe endpoint, which sets the prediction flag only — leaving quiz opt-out untouched. Independent flags let a player keep one reminder and drop the other.
*Alternative considered:* a single shared "email reminders" toggle. Rejected — coarser control; users likely value the prediction reminder more than the quiz one.

### Email: list fixtures, CTA to picks
The renderer takes already-localized strings plus a list of `{ home, away, kickoffLabel }` rows and renders email-safe HTML (table layout, inline styles, fixed hex) matching the quiz/result look. Kickoff times are formatted in the email at a single reference zone (UTC) with the zone shown, since there is no per-recipient timezone. CTA links to `${siteUrl}${localePath(DEFAULT_LOCALE, "/matches?picks=needed")}` — the existing "needs pick" filter. Send in `DEFAULT_LOCALE` (en), as the quiz reminder does.

### Schedule
Run at `0 12 * * *` (12:00 UTC) — after `sync-matches` (09:00 UTC) so fixture data/status is fresh, and before typical afternoon/evening kickoffs. Matches already started by send time are filtered out by the open-match rule, so an early-day kickoff simply won't be in the reminder.

## Risks / Trade-offs

- **UTC "today" misaligns with a player's local day** → Matches near a UTC midnight boundary may land in the "wrong" day's reminder for some players. Mitigation: acceptable for v1; the open-match filter guarantees we never remind about something already locked. Tournament-timezone option noted in Open Questions.
- **Very early kickoffs (before 12:00 UTC) get no reminder** → They're filtered as already-open. Mitigation: schedule chosen to cover the bulk of fixtures; could add a second earlier run later if needed.
- **Ledger row write fails after a successful send** → Risks a duplicate next run. Mitigation: log loudly (same posture as quiz module); duplicate-per-day is bounded and low-harm.
- **Large recipient set exceeds function budget** → `maxDuration = 60`, paginated reads, batched sends (≤100). Mitigation: matches the quiz job's limits; revisit if the pool grows large.
- **Migration adds a NOT NULL column** → Use `default false` so existing rows backfill safely; no downtime.

## Migration Plan

1. Supabase migration: create `prediction_reminder_log`; add `profiles.prediction_reminder_opt_out boolean not null default false`. Add RLS consistent with existing tables (service-role writes; the unsubscribe route uses the admin client).
2. Regenerate `lib/database.types.ts`.
3. Ship dispatcher, template, cron route, unsubscribe route, and i18n strings.
4. Add the cron entry to `vercel.json`.
5. Verify in preview/non-prod (no `CRON_SECRET` → safe skip in prod; manual GET with bearer in a test env). Rollback: remove the `vercel.json` cron entry (sending stops immediately); table/column are inert if unused.

## Open Questions

- Should "today" use a fixed tournament timezone instead of UTC? Default to UTC for v1.
- Should the CTA deep-link to `/my-picks` instead of `/matches?picks=needed`? Default to the matches "needs pick" filter.
- Do we want a second, earlier run to cover pre-noon-UTC kickoffs? Default to a single 12:00 UTC run.
