## Why

The knockout rounds are the peak-engagement moment of the tournament, and with stage-weighted scoring a single playoff result can swing the standings far more than a group game. Saturdays are the marquee knockout match days, so a once-a-week email that tells every opted-in player the final scorelines of that Saturday's playoff matches is a high-value, low-friction retention touchpoint — it reaches players who didn't open the app and gives them a reason to come back.

## What Changes

- Add a **Saturday-only digest cron** that, after that day's results are synced and scored, emails **all opted-in players** the final scorelines of the day's finished **playoff (knockout) matches**.
- The email body is intentionally minimal: **just the new scores** — for each finished knockout match that Saturday, the two teams and the final scoreline (knockout result indicator, e.g. extra time / penalties, where present). No per-player points, standings, or bracket sections in this change.
- Reuse the established email plumbing — pure localized renderer, dispatcher, Resend batch send, `isOptedIn` gating, `recordRun` instrumentation, and the production email-sender guard — with no new third-party dependency.
- Add a **per-Saturday, per-recipient dedupe ledger** so a re-run of the cron on the same Saturday never double-sends, mirroring `results_digest_log`.
- Register the new cron in `vercel.json` on a weekly Saturday UTC schedule that runs after `sync-matches`.
- Skip cleanly (send nothing) on Saturdays with **no finished playoff matches**, and on any non-playoff stage.

## Capabilities

### New Capabilities
- `saturday-playoff-score-email`: A weekly, Saturday-scheduled digest that emails all opted-in players the final scorelines of that Saturday's finished knockout-stage matches. Covers the cron route + auth + `recordRun` isolation, the playoff-match selection (current competition, `final` status, non-group stage, kicked off that Saturday), the scoreline-only localized renderer, all-opted-in recipient resolution, the per-Saturday dedupe ledger, and the empty-day no-send behavior.

### Modified Capabilities
<!-- None. The email is gated by the existing general email opt-in (isOptedIn); it introduces no new preference category, so email-preferences requirements are unchanged. Selection reuses the existing matches.stage model with no requirement changes to playoff-bracket or match-results. -->

## Impact

- **New code**: `app/api/cron/playoff-score-saturday/route.ts` (cron route), `lib/notifications/playoff-score-emails.ts` (dispatcher), `lib/notifications/playoff-score-template.ts` (pure renderer).
- **Config**: new `crons` entry in `vercel.json` (weekly Saturday UTC, after `sync-matches`).
- **Database**: new `playoff_score_email_log` dedupe table (`(digest_date, user_id)` PK, RLS-enabled, service-role only) + a creation/backfill migration so the first deploy does not email a Saturday already in progress.
- **i18n**: new `playoffScoreEmail` namespace in `messages/{en,es,fr,de}.json`.
- **Reused**: `isOptedIn` / `email-prefs`, `checkEmailSenderConfig`, `recordRun`, Resend client, `getActiveBranding`, `matches.stage` selection, `DEFAULT_LOCALE` / `localePath`.
- **No breaking changes**; additive only.
