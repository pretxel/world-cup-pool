# Proposal: add-pool-winners-email

## Why

When the competition ends, the pool's podium finishers get no recognition — the app has result, digest, and announcement emails, but nothing that congratulates the winners. The admin needs a way to close out the pool with a one-off congratulation email to the top players, fired manually from the Operations control room when the final standings are settled.

## What Changes

- New transactional email: a winners congratulation sent to the pool's podium (every player with final rank ≤ 3 on the overall leaderboard, ties included). It shows the recipient's final rank and points, the full podium, and links to the leaderboard.
- New manual-only operation kind `winners_email`: a tile on the admin Operations overview (`?view=overview`) with a "Run now" button and "Manual only" schedule, run history in the runs ledger — exactly like `score_rules_email`.
- At-most-once delivery via a new `winners_email_log` ledger table (same posture as `score_rules_email_log`): re-running the job never double-sends; a partial failure leaves unsent winners pending for the next run.
- The new template joins the admin email previews (template #12) with fixture data.

## Capabilities

### New Capabilities

- `pool-winners-email`: Congratulation email to the pool's final podium, dispatched manually from the admin Operations overview, idempotent per recipient, localized, and respecting email preferences.

### Modified Capabilities

- `admin-email-preview`: template roster grows from eleven to twelve — the winners email must appear in the preview selector and render with sample data.

## Impact

- **DB**: new migration — `winners_email_log` table (RLS enabled, no policies, service-role only) + extend the `operation_runs_kind_check` constraint with `winners_email`. Remote application is manual (deploys don't run migrations; apply via pooler psql and record in migration history).
- **Server**: new `lib/notifications/winners-email-template.ts` (pure renderer) and `lib/notifications/winners-emails.ts` (strings builder + dispatch off `v_leaderboard_overall`); new entry in `OPERATION_KINDS`, the operations `JOB`/`RUN_ACTION` maps, and the email preview registry/fixtures.
- **UI**: no new pages — the existing overview tile grid and previews view pick the new kind up from the registries.
- **i18n**: new `winnersEmail` namespace plus `admin.operations.jobs.*`/preview label keys in `messages/{en,es,fr,de}.json`.
