## Why

Today the result-sync cron silently recomputes scores whenever a match goes final — players only discover their points moved if they reopen the site. Emailing each affected player their fresh standing right after a match finalizes turns a passive scoreboard into an active re-engagement loop, and it costs us nothing extra because the cron already knows exactly when and whose scores changed.

## What Changes

- After the `sync-matches` cron finalizes one or more matches and recomputes scores, the system sends a transactional email to **each player whose standing changed** — i.e. anyone who had a prediction scored for a match that newly went final.
- The email is a **personal standing snapshot**: the player's current rank, total points, exact + winner/GD hit counts, the points they earned this round, and the match(es) that just finalized (teams, final scoreline, and the player's per-match outcome).
- A new HTML email template mirrors the web look — pitch-green header, cream body, gold "leader/you" accents, mono uppercase labels, and the same ranking-card visual language as the leaderboard — using email-safe inline styles and table layout (hex equivalents of the app's oklch tokens).
- Delivery goes through **Resend** (`RESEND_API_KEY` already provisioned), batched per Resend's limits, with a plain-text fallback part.
- A **dedupe ledger** guarantees at-most-once delivery per (match, player): a match's finalization emails its players exactly once, surviving idempotent cron re-runs and crashes. The migration **backfills the ledger for all already-final matches** so shipping the feature does not blast historical results.
- Email failures are isolated: they are logged and never fail the cron or block score syncing; unsent rows are retried on the next run.
- Out of scope (this change): per-user locale selection (emails send in the default locale), opt-out/unsubscribe management, and digest/scheduling preferences.

## Capabilities

### New Capabilities
- `result-email-notifications`: Defines who is emailed when scores recalc, the trigger (a match transitioning to final), the per-player snapshot content, the web-matching email template + branding, Resend delivery + batching, the at-most-once dedupe ledger and its backfill, the default-locale rule, and the failure-isolation contract.

### Modified Capabilities
- `automated-results`: The cron sync run gains a post-recompute step that dispatches result-standing emails for matches that newly reached `final`. Adds a requirement that the run triggers email dispatch and that email failures never fail the sync.

## Impact

- **New code**: `lib/notifications/result-emails.ts` (recipient resolution, snapshot assembly, Resend dispatch), `lib/notifications/result-email-template.ts` (HTML + text renderer), wired into `app/api/cron/sync-matches/route.ts` after `runSync()`.
- **Env**: adds `RESEND_API_KEY` (already set) and `EMAIL_FROM` to `lib/env.ts`, nullable and gated like the existing cron env vars (absent → email step is skipped, sync still runs).
- **Dependencies**: adds the `resend` npm package.
- **Database**: new `result_email_log(match_id, user_id, sent_at)` table with a unique `(match_id, user_id)` constraint and RLS; a migration that creates it and backfills existing finals. Reads `scores`, `v_leaderboard_overall`, `matches`, `profiles`, and `auth.users` (emails, via the service-role admin client).
- **i18n**: new `email` namespace strings in `messages/{en,es,fr}.json` (rendered in the default locale for now).
- **Affected systems**: the Vercel cron response summary may report an `emailed` count; no change to the sync's scoring or matching behavior.
