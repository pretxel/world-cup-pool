## 1. Data: dedupe ledger, rank snapshot, email pref

- [x] 1.1 Add a Supabase migration under `supabase/migrations/` (timestamped filename, e.g. `20260620000000_results_digest_log.sql`) creating `public.results_digest_log (digest_date date not null, user_id uuid not null references public.profiles(id) on delete cascade, sent_at timestamptz not null default now(), primary key (digest_date, user_id))`; enable RLS with no policies (service-role only), matching `result_email_log`.
- [x] 1.2 In the same (or an adjacent timestamped) migration, backfill `results_digest_log` for the current UTC date for all players so the first deploy does not blast a same-day digest.
- [x] 1.3 Add a Supabase migration creating `public.leaderboard_rank_snapshot (snapshot_date date not null, user_id uuid not null references public.profiles(id) on delete cascade, rank int not null, primary key (snapshot_date, user_id))`; enable RLS with no policies (service-role only). Document the comment that it is written only by the service-role digest dispatcher.
- [x] 1.4 Add a Supabase migration adding the `results_digest` key (default `true`) to the `profiles.email_prefs` jsonb default; existing rows are safe because a missing key reads as opted-in.

## 2. Email preferences plumbing

- [x] 2.1 In `lib/email-prefs.ts`, add `"results_digest"` to `EMAIL_PREF_KEYS`, to `DEFAULT_EMAIL_PREFS` (`true`), to `emailPrefsSchema` (`z.boolean()`, partial), and to `normalizeEmailPrefs`.
- [x] 2.2 Confirm `isOptedIn(prefs, "results_digest")` returns the `!== false` (default-on) semantics with no code change.

## 3. Renderer: results-digest-template.ts

- [x] 3.1 Create `lib/notifications/results-digest-template.ts` as a pure, dependency-free renderer modeled on `result-email-template.ts` (fixed hex palette, table layout, inline styles, no `oklch`/`var()`/stylesheets).
- [x] 3.2 Define `ResultsDigestStrings` (subject, preheader, eyebrow, heading/headingNoName, intro, top5 label, your-rank label, rank-delta labels, movers label, climbed/dropped labels, cta label, footer) and `ResultsDigestData` (displayName, top5 rows, yourRank/yourPoints/yourDelta-or-null, movers-or-null, leaderboardUrl, strings).
- [x] 3.3 Render the brand header, intro, top-5 table, the personal rank + delta block (omitted-gracefully when delta is null), the biggest-movers section (omitted when null), a `/leaderboard` CTA, and a footer.
- [x] 3.4 Emit both `html` and `text` parts and return `{ subject, html, text }`; HTML-escape all interpolated copy and data.

## 4. Dispatcher: results-digest-emails.ts

- [x] 4.1 Create `lib/notifications/results-digest-emails.ts` (`server-only`) exporting `dispatchResultsDigest(fromName?: string): Promise<DispatchSummary>`, modeled on `dispatchResultEmails` in `result-emails.ts` (share `DispatchSummary`/`isSendableEmail`/the `resolveEmail` pattern/`checkEmailSenderConfig`).
- [x] 4.2 No-op (log + zero summary) when `env.resendApiKey` is unset; call `checkEmailSenderConfig` and carry `senderMisconfigured` on the summary when the prod sender is misconfigured, without changing the resolved sender.
- [x] 4.3 Load standings from `v_leaderboard_overall` (rank, display_name, total_points, user_id); derive the top 5 and the active-recipient set.
- [x] 4.4 Upsert today's `leaderboard_rank_snapshot` from the standings, then load the most recent prior snapshot to compute per-user deltas and the day's biggest movers; omit deltas/movers when no prior snapshot exists.
- [x] 4.5 Load today's `results_digest_log` rows and drop already-sent recipients; load `profiles.email_prefs` for the candidates and drop those with `results_digest === false` via `isOptedIn`.
- [x] 4.6 Resolve each recipient's email via the admin `getUserById` pattern; skip missing/undeliverable addresses (`isSendableEmail`), counting them as `skipped`.
- [x] 4.7 Build localized copy via `getTranslations({ locale: DEFAULT_LOCALE, namespace: "resultsDigest" })`; build the `/leaderboard` URL from `env.siteUrl` + `localePath(DEFAULT_LOCALE, "/leaderboard")`; resolve the sender via `env.emailFrom` with the optional `fromName` override.
- [x] 4.8 Render per-recipient and batch-send (≤100) via `resend.batch.send`; on an accepted batch, upsert `results_digest_log` rows for that batch with `onConflict: "digest_date,user_id", ignoreDuplicates: true`; on a rejected batch, log + count `failed` and leave those recipients pending.
- [x] 4.9 Return `{ emailed, failed, skipped }` (plus `senderMisconfigured` when applicable).

## 5. Cron route

- [x] 5.1 Create `app/api/cron/results-digest/route.ts` modeled on `app/api/cron/prediction-reminders/route.ts`: `export const maxDuration = 60`, Bearer `CRON_SECRET` auth (allow non-prod when unset, 401 on mismatch, 204 skip on missing-env in prod).
- [x] 5.2 Wrap the dispatch in `recordRun("results_digest", "cron", async () => { const { emailFromName } = await getActiveBranding(); return await dispatchResultsDigest(emailFromName); })`; isolate failures (catch → log → zero summary) and return the summary as JSON.
- [x] 5.3 Register the route in `vercel.json` `crons` on a fixed UTC schedule a few hours after `sync-matches` (`0 9 * * *`), e.g. `0 11 * * *`.

## 6. Operations integration

- [x] 6.1 Add `"results_digest"` to `OperationKind` and `OPERATION_KINDS` in `lib/operations/record-run.ts`; confirm the existing `FAILURE_KEYS` (`failed`) classification yields `success`/`partial` for the digest summary with no other change.

## 7. i18n

- [x] 7.1 Add a `resultsDigest` namespace to `messages/en.json` with all `ResultsDigestStrings` keys.
- [x] 7.2 Mirror the namespace in `messages/es.json`, `messages/fr.json`, and `messages/de.json` with translated copy.

## 8. Verification

- [x] 8.1 Run typecheck (`tsc --noEmit` / project typecheck script) — no errors.
- [x] 8.2 Run lint — no new violations.
- [x] 8.3 Add/run unit tests: the pure renderer (HTML + text contain top-5, your-rank, movers, and the `/leaderboard` link; delta/movers omitted when null); the dispatcher's dedupe (no re-send when a `results_digest_log` row exists for today), opt-out filtering (`results_digest === false` dropped, missing key kept), no-op when `RESEND_API_KEY` unset, and delta computation from a prior snapshot.
- [x] 8.4 Manual check: with `RESEND_API_KEY` set and `EMAIL_FROM` a verified-domain sender, hit `/api/cron/results-digest` with a valid bearer twice; confirm exactly one digest arrives per opted-in player, the top-5/your-rank/movers render, the second run re-sends nothing, and an `operation_runs` row appears with kind `results_digest`.
- [x] 8.5 Confirm the `EMAIL_FROM` prod dependency (análisis.md QW1) is noted for deployment — without a verified-domain sender the digest reaches only the account owner.
