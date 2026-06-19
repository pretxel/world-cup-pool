## Context

The repo runs four daily background jobs as Vercel crons (`vercel.json`): `sync-matches`, `sync-news`, `quiz-reminders`, `prediction-reminders`. Each is an `app/api/cron/*/route.ts` GET handler with a uniform shape (`prediction-reminders/route.ts` is the cleanest model): require `Bearer ${CRON_SECRET}` (allow in non-prod when unset), set `maxDuration = 60`, run the dispatch inside `recordRun(kind, "cron", fn)` so exactly one `operation_runs` row is written, isolate failures (catch → log → zero summary, never a 500), and return the summary as JSON.

The email-sending pattern is equally uniform across `result-emails.ts`, `quiz-reminder-emails.ts`, `prediction-reminder-emails.ts`, and `welcome-email.ts`:

- A **pure renderer** (`result-email-template.ts`) builds email-safe HTML (table layout, inline styles, fixed hex palette mirroring the light theme, no `oklch`/`var()`/stylesheets) plus a plain-text part, with all copy passed in as a `*EmailStrings` object — no DB/network, fully unit-testable.
- A **server-only dispatcher** gates on `env.resendApiKey`, resolves recipient emails from `auth.users` via the service-role admin client (`createAdminSupabaseClient`), builds localized strings via `getTranslations({ locale: DEFAULT_LOCALE, namespace })`, derives URLs from `env.siteUrl` + `localePath`, batch-sends via `resend.batch.send` (≤100/batch, all-or-nothing), and writes a dedupe ledger row only for batches the provider accepted. `result-emails.ts` also exports reusable guards (`isSendableEmail`, the `resolveEmail` pattern) and the `email-sender-config.ts` `checkEmailSenderConfig` warning.

The digest is structurally close to the result email but differs in three ways. (1) Its trigger is **time**, not a state change: it fires once per day for *everyone* opted in, regardless of whether their standing moved — so the "pending" computation is "every active player who hasn't received today's digest", not "every player whose match scored". (2) Its dedupe key is the **day**, not `(match, user)`. (3) It needs a **previous-day baseline** to compute "your rank delta" and "biggest movers", which the current schema does not store — `v_leaderboard_overall` is a live view with no history.

Standings come from `v_leaderboard_overall` (already queried by `result-emails.ts` and `leaderboard/page.tsx`): `user_id, display_name, total_points, exact_hits, winner_gd_hits, winner_hits, first_submit, rank` (admins excluded). The "day" is defined by `matches.kickoff_at` (timestamptz); "yesterday" is the UTC calendar day before the cron fires.

## Goals / Non-Goals

**Goals:**
- Send at most one results digest per opted-in player per day, via a new daily cron, deduped so a re-run never double-sends.
- Content: the leaderboard top 5, the recipient's own rank + day-over-day rank delta, and the day's biggest movers.
- Reuse the existing cron + renderer + dispatcher + Resend + i18n + `recordRun` patterns with no new infrastructure or third-party dependency.
- Honor `profiles.email_prefs` with a new `results_digest` per-type opt-out (default opted-in), via the existing `isOptedIn` semantics.
- Be best-effort and isolated: a failure logs and records `status='error'`, never trips cron alerting into retry-storming, never throws past the route's catch.
- No-op when `RESEND_API_KEY` is unset; warn (not fail) when the prod sender is misconfigured, via `checkEmailSenderConfig`.

**Non-Goals:**
- Per-timezone send segmentation (M6) — the digest sends once at a fixed UTC schedule, like every existing cron.
- Recap/comic digest (M9) or comeback-to-inactive email (M11).
- Push notifications, an in-app digest feed, or any UI surface for the digest.
- Changing scoring, `v_leaderboard_overall`, or how standings are computed.
- Suppressing the digest for inactive users beyond the opt-out (fatigue tuning is future work).

## Decisions

- **New cron route, fixed daily UTC schedule.** Add `app/api/cron/results-digest/route.ts` modeled byte-for-byte on `prediction-reminders/route.ts` (Bearer auth, `maxDuration = 60`, `recordRun` wrap, isolated catch, JSON summary). Register it in `vercel.json` with a schedule a few hours after `sync-matches` (which runs `0 9 * * *`) so the prior day's finals are scored before the digest computes — e.g. `0 11 * * *`. Single fixed UTC time is consistent with all existing crons; per-timezone is explicitly M6.
- **Dedupe ledger keyed by day** (`results_digest_log`): primary key `(digest_date, user_id)`, `sent_at timestamptz default now()`, FKs to `profiles(id)`/cascade, RLS enabled with no policies (service-role only) — the exact posture of `result_email_log` but day-scoped. A `(digest_date, user_id)` row is written only after Resend accepts the batch, giving at-most-once delivery per player per day across idempotent re-runs and crashes. The migration **backfills today's date for all players** so the first deploy does not blast a digest for the current day.
- **Per-day rank snapshot for deltas + movers** (`leaderboard_rank_snapshot`): primary key `(snapshot_date, user_id)`, `rank int`, RLS enabled with no policies. The cron, before sending, upserts *today's* snapshot from `v_leaderboard_overall`, then computes each player's delta and the day's biggest movers as `today.rank - yesterday.rank` (negative = climbed). A dedicated snapshot table (vs. deriving history from `scores` timestamps) is chosen because `rank()` is a window over the whole board at a point in time and cannot be reconstructed cheaply after the fact; the snapshot is the minimal durable baseline. On the very first run there is no prior snapshot, so deltas/movers are omitted (the digest still sends top-5 + your-rank).
- **Recipient set = active opted-in players.** The digest targets players who appear in `v_leaderboard_overall` (i.e. have submitted at least one scored prediction; admins already excluded by the view) and are not opted out of `results_digest`. This avoids emailing accounts that have never played. Pending = (those players) − (those with a `results_digest_log` row for today).
- **Opt-out via `email_prefs`.** Add `results_digest` to `EMAIL_PREF_KEYS`, `DEFAULT_EMAIL_PREFS` (true), `emailPrefsSchema`, and `normalizeEmailPrefs` in `lib/email-prefs.ts`; add the key to the `profiles.email_prefs` jsonb default in a migration. Drop opted-out recipients with the same `isOptedIn(prefs, "results_digest") === false` filter `result-emails.ts` uses for `result`. A missing/malformed key stays opted-in.
- **Renderer.** New `results-digest-template.ts` mirrors `result-email-template.ts`: pure, dependency-free, HTML + text, fixed hex palette, all copy via a `ResultsDigestStrings` object, single CTA deep-linking to `/leaderboard` via `env.siteUrl` + `localePath`. Day-shared sections (top 5, movers) render identically for every recipient; only the personal rank/delta block varies.
- **Localization & sender identity.** Resolve copy from a new `resultsDigest` namespace at `DEFAULT_LOCALE` (every cron dispatcher sends at `DEFAULT_LOCALE` because the cron context has no request locale). Use `env.emailFrom`, with the active-branding from-name override threaded through exactly like `prediction-reminders/route.ts` does (`getActiveBranding().emailFromName`). Reuse `withFromName`'s semantics if a name override is passed.
- **Run recording.** Add `results_digest` to `OperationKind`/`OPERATION_KINDS`. The dispatcher returns a `DispatchSummary`-shaped `{ emailed, failed, skipped }`, so `recordRun`'s existing `FAILURE_KEYS` (`failed`) classification works unchanged (`success` vs `partial`).
- **No-op / warn gating.** Identical to `dispatchResultEmails`: no-op + log when `env.resendApiKey` is unset; call `checkEmailSenderConfig` and warn (carry `senderMisconfigured` on the summary) when the prod sender is the sandbox default, without changing the resolved sender.

## Risks / Trade-offs

- **DB migrations required (two new tables + one `email_prefs` default change).** All purely additive, service-role-only, RLS-enabled-no-policies, matching `result_email_log`. The `email_prefs` default change adds a key to the jsonb default; existing rows are unaffected because `isOptedIn` treats a missing key as opted-in, so no destructive backfill is needed (the migration MAY backfill the key for completeness but is not required to). Snapshot growth is bounded (one row per active player per day) and can be pruned later if needed.
- **No previous-day baseline on first run.** The very first cron run has no `leaderboard_rank_snapshot` for "yesterday", so rank deltas and the movers section are omitted that day; they appear from the second run onward. Acceptable — the digest is still useful (top 5 + your rank) and self-heals after one day.
- **Fixed UTC schedule misses time zones (shared limitation, M6).** Everyone gets the digest at the same instant; players in the Americas may receive it overnight. This is the same trade-off every existing cron makes; per-timezone segmentation is the separate M6 bet and explicitly out of scope.
- **`EMAIL_FROM` unset in prod (blocking dependency, análisis.md QW1).** `lib/env.ts:46` falls back to the sandbox sender that Resend only delivers to the account owner. Until `EMAIL_FROM` is a verified-domain sender, the digest "succeeds" but reaches no one. Mitigation: `checkEmailSenderConfig` already surfaces this as a run warning; the feature is otherwise complete and starts working the moment the env var is set.
- **`RESEND_API_KEY` unset (dev/staging).** The dispatch no-ops silently and writes no ledger/snapshot for that run. Consistent with every existing dispatcher.
- **Email fatigue.** A daily email on top of result/reminder/quiz emails increases volume. Mitigated by the dedicated `results_digest` opt-out (so a player can silence just this one) and by targeting only active players; broader fatigue suppression (e.g. skip days with no matches) is a future refinement, not part of this bet.
- **Locale mismatch.** Sending at `DEFAULT_LOCALE` may not match a user's chosen UI locale — consistent with all existing emails; locale propagation is out of scope.
