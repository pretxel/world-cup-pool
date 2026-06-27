## Why

Scoring just changed to stage-weighted points (group ×1 → final ×10), but existing players were never told — they only see the new numbers if they happen to read the landing page. The pool owner needs a way to announce the new scoring rules to every player by email, on demand, from the admin area, without risking duplicate sends.

## What Changes

- Add an admin-triggered **"Send scoring-rules announcement"** email that explains the new stage-weighted scoring to all players.
- The email's per-phase points table is derived from the shared scoring constants (`BASE_POINTS` × `STAGE_POINT_MULTIPLIER`), so it can never drift from the actual scorer (same source as the landing-page explainer).
- Surface it in the existing **operations control room** as a new job tile with a "Run now" button, reusing the `recordRun` instrumentation and inline summary UI. It is **manual-only** — no cron schedule.
- Make it **idempotent**: a new send-once ledger ensures each player receives the announcement at most once across runs, so an admin can safely re-press "Run now".
- Respect email opt-out and the production-sender guard, mirroring the existing broadcast emails.

## Capabilities

### New Capabilities

- `score-rules-announcement-email`: an admin-triggered, idempotent broadcast email that announces the current stage-weighted scoring rules to all opted-in players, with content derived from the shared scoring constants.

### Modified Capabilities

- `admin-operations-monitoring`: the per-job health tile must accommodate a **manual-only** job that has no next scheduled run (shows a "manual only" indication instead of a next-run time), and the on-demand trigger set includes the new announcement job.

## Impact

- **Code (new)**
  - `lib/notifications/score-rules-template.ts` — pure, unit-testable email renderer (HTML + text), per-phase table from shared constants.
  - `lib/notifications/score-rules-emails.ts` — `dispatchScoreRulesEmail(fromName?)`: recipient selection, opt-out, idempotency ledger, Resend batch send (mirrors `playoff-score-emails.ts`).
- **Code (modified)**
  - `lib/operations/record-run.ts` — add `score_rules_email` to `OperationKind` / `OPERATION_KINDS`.
  - `lib/operations/schedule.ts` — allow a kind with no cron schedule; `nextScheduledRun` returns null (or equivalent) for manual-only jobs.
  - `app/[locale]/(admin)/admin/operations/actions.ts` — add the job to `JOB` and a `runScoreRulesEmail` action.
  - `app/[locale]/(admin)/admin/operations/overview.tsx` — wire the action into `RUN_ACTION`; render "manual only" when a job has no next run.
- **Data**: new `score_rules_email_log` table (one row per user, RLS service-role-only, mirroring `playoff_score_email_log`). No schema change to existing tables.
- **i18n**: new `scoreRulesEmail` namespace and `admin.operations.jobs.score_rules_email` / `jobsDesc` labels across en/es/fr/de.
- **No impact** on the scorer, leaderboards, cron routes (no new cron), or other emails.
