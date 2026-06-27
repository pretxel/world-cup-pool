## 1. Data

- [x] 1.1 Add a Supabase migration creating `score_rules_email_log (user_id uuid primary key references profiles on delete cascade, sent_at timestamptz not null default now())`, mirroring `playoff_score_email_log`'s RLS (service-role only; no policies granting public access) and adding `score_rules_email` to the `operation_runs` kind CHECK. Hand-added the table to `lib/database.types.ts` (migration not yet applied remotely).

## 2. Email template

- [x] 2.1 Create `lib/notifications/score-rules-template.ts` — pure renderer (HTML + text) modeled on `playoff-score-template.ts`: header, intro, a per-phase points table, CTA, footer. It receives precomputed phase rows + already-localized strings; no constants/network import (unit-testable).
- [x] 2.2 Define the template's data types: `ScoreRulesPhaseRow { stageLabel, multiplier, exact, winnerGd, winner }`, `ScoreRulesStrings`, `ScoreRulesData`, `ScoreRulesRendered`.

## 3. Dispatcher

- [x] 3.1 Create `lib/notifications/score-rules-emails.ts` exporting `dispatchScoreRulesEmail(fromName?): Promise<DispatchSummary>`, modeled on `dispatchPlayoffScoreEmail`: sender-guard warn + `senderMisconfigured` flag, no-op when `RESEND_API_KEY` unset.
- [x] 3.2 Build the per-phase rows from `BASE_POINTS` × `STAGE_POINT_MULTIPLIER` (same stage order as `components/scoring-explainer.tsx`), with localized stage labels via `getStageLabel` for the active competition format.
- [x] 3.3 Select recipients: page all `profiles`, exclude users in `score_rules_email_log`, exclude opted-out via `isOptedIn(prefs, "results_digest")`. Add a pure, exported `computePendingRecipients(profiles, alreadySent)` for unit testing.
- [x] 3.4 Resolve addresses via the service-role admin client, filter with `isSendableEmail`, send in Resend batches ≤100, and upsert ledger rows only for accepted batches. Return `{ emailed, failed, skipped }`.

## 4. Operations integration

- [x] 4.1 In `lib/operations/record-run.ts`, add `score_rules_email` to `OperationKind` and `OPERATION_KINDS`.
- [x] 4.2 In `lib/operations/schedule.ts`, allow a kind with no cron: make `OPERATION_SCHEDULES` a partial map (or omit `score_rules_email`) and have `nextScheduledRun` return `null` for a scheduleless kind.
- [x] 4.3 In `app/[locale]/(admin)/admin/operations/actions.ts`, add `score_rules_email` to `JOB` (calls `dispatchScoreRulesEmail` with the active branding name) and export `runScoreRulesEmail`.
- [x] 4.4 In `app/[locale]/(admin)/admin/operations/overview.tsx`, add the action to `RUN_ACTION` and render a "manual only" indication when `nextScheduledRun` is null (keep the "Run now" button).

## 5. i18n

- [x] 5.1 Add a `scoreRulesEmail` namespace (subject, preheader, eyebrow, heading, intro, table labels/tiers, ctaLabel, footer) to `messages/en.json`, `es.json`, `fr.json`, `de.json`.
- [x] 5.2 Add `admin.operations.jobs.score_rules_email` and `jobsDesc.score_rules_email` labels in all locales; add an `overview.manualOnly` label for the next-run slot.

## 6. Verify

- [x] 6.1 Unit tests: template renders phases/points correctly (incl. derived points); `computePendingRecipients` excludes already-sent and opted-out; `nextScheduledRun` returns null for the manual-only kind.
- [x] 6.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test` — all pass (typecheck clean; lint pre-existing warnings only; 1016/1016 tests).
- [ ] 6.3 Manually verify in admin: the new tile shows "manual only"; "Run now" sends (or no-ops cleanly without a provider key), shows the inline summary, and a second run reports zero new sends (idempotent). (Blocked: the `score_rules_email_log` migration must be applied to the target DB and an admin session is required — not auto-applying schema to the shared/remote database.)
