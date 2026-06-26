## 1. Database: dedupe ledger

- [x] 1.1 Add migration creating `public.playoff_score_email_log` with primary key `(digest_date, user_id)`, `created_at` default `now()`, and a foreign key on `user_id`
- [x] 1.2 Enable RLS on the table with no policies (service-role-only), matching `result_email_log` / `results_digest_log`
- [x] 1.3 In the same migration, backfill the current day's ledger for all players so the first deploy does not email a Saturday already in progress
- [x] 1.4 Regenerate Supabase TypeScript types so the new table is typed

## 2. Renderer (pure, localized, scoreline-only)

- [x] 2.1 Create `lib/notifications/playoff-score-template.ts` exporting a pure `renderPlayoffScoreEmail(strings, data)` returning `{ subject, html, text }`
- [x] 2.2 Define typed inputs: a `PlayoffScoreMatch` list (`home`, `away`, `homeScore`, `awayScore`, optional `resultNote`) and a `PlayoffScoreStrings` copy bag (no hardcoded strings in the renderer)
- [x] 2.3 Render an email-safe HTML table with inline styles and fixed hex colors only (no `oklch`/`var()`/stylesheets); HTML-escape all interpolated copy and data
- [x] 2.4 Render a matching plain-text part with the same scorelines
- [x] 2.5 Include a single CTA deep-linking to `/bracket` via `env.siteUrl` + `localePath(DEFAULT_LOCALE, "/bracket")`
- [x] 2.6 Ensure no points / hit / rank / movers / bracket-progression sections are emitted

## 3. i18n copy

- [x] 3.1 Add a `playoffScoreEmail` namespace (subject, intro, decider-note label, CTA label, footer) to `messages/en.json`
- [x] 3.2 Translate the namespace into `messages/es.json`, `messages/fr.json`, and `messages/de.json`

## 4. Dispatcher

- [x] 4.1 Create `lib/notifications/playoff-score-emails.ts` exporting `dispatchPlayoffScoreEmail(emailFromName)` returning a `DispatchSummary` (`{ emailed, failed, skipped, senderMisconfigured? }`)
- [x] 4.2 Compute the target Saturday window from the run date in the competition reference timezone
- [x] 4.3 Select active-competition matches with `status = 'final'`, `stage <> 'group'`, kickoff within the Saturday window; map to `PlayoffScoreMatch[]` (include decider note when available)
- [x] 4.4 Short-circuit to a zero summary (no send, no ledger writes) when no matches are selected
- [x] 4.5 Resolve recipients as all `isOptedIn` players with a usable address, excluding those with a `playoff_score_email_log` row for the target date (pending-recipient query)
- [x] 4.6 Resolve copy via `getTranslations({ locale: DEFAULT_LOCALE, namespace: "playoffScoreEmail" })`, render, and send through Resend in ≤100-message batches
- [x] 4.7 Write a `playoff_score_email_log` row only after Resend accepts the batch containing each recipient (failed sends stay pending)
- [x] 4.8 Run the production email-sender guard (`checkEmailSenderConfig`) and set `senderMisconfigured` on the summary when it warns; apply the `from`-name override like the other dispatchers

## 5. Cron route

- [x] 5.1 Create `app/api/cron/playoff-score-saturday/route.ts` (GET) mirroring `results-digest/route.ts`: Bearer `CRON_SECRET` auth (401 on mismatch, allow non-prod when unset, skip prod when unset)
- [x] 5.2 Wrap dispatch in `recordRun("playoff_score_email", "cron", …)` using `getActiveBranding()` for the `from` name
- [x] 5.3 Isolate failures (catch + log), return a `{ emailed, failed, skipped }` JSON summary instead of a 500, and raise `maxDuration`
- [x] 5.4 Defensively confirm the run date is a Saturday before dispatching

## 6. Schedule

- [x] 6.1 Add a `crons` entry to `vercel.json` for `/api/cron/playoff-score-saturday` on a weekly Saturday UTC schedule after `sync-matches` (e.g. `0 11 * * 6`)

## 7. Tests

- [x] 7.1 Renderer test: scorelines + decider note present, no points/rank/bracket sections, HTML is escaped and uses fixed hex colors
- [x] 7.2 Selection test: `final` non-group matches in the Saturday window are picked; group / live / out-of-window matches excluded; timezone boundary covered
- [x] 7.3 Dispatcher test: all opted-in players (incl. non-predictors) emailed; opted-out excluded; ledger written only after batch acceptance; same-day re-run does not re-send; empty Saturday returns a zero summary with no ledger writes
- [x] 7.4 Route test: 401 on bad/missing bearer when secret set; authorized run records one `playoff_score_email` run and returns the summary; dispatch throw is caught and recorded as `error` with a zero-summary 200 response

## 8. Verification

- [x] 8.1 Run `pnpm typecheck`, `pnpm lint`, and the new tests
- [x] 8.2 Run `openspec validate saturday-playoff-score-email --strict` and confirm it passes
