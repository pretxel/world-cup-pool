# Rank-change notification

## Why

The result email (`lib/notifications/result-emails.ts`) already tells a player
their new standing after a match finalizes, but it only shows the absolute rank
(`#7`). It says nothing about movement. The biggest re-engagement hook of a
leaderboard — "you moved up 3 to #7" — is missing, which análisis.md flags as
medium bet **M3** ("Notificación de cambio de rank") and in the interaction
catalog under "Competitivo / Rank delta badges". The data needed is already
flowing: `runSync()` recomputes `scores` before `dispatchResultEmails()` runs in
the sync-matches cron, so the *new* rank is live in `v_leaderboard_overall` at
send time. What is missing is the *previous* rank — nothing captures it before
the recompute overwrites the standing.

## What Changes

- Capture each player's overall rank into a small snapshot table at the start of
  the sync-matches run, before `runSync()` recomputes scores.
- In the result-email dispatch, look up the snapshot rank for each affected
  player and compute the delta against the new rank already read from
  `v_leaderboard_overall`.
- Pass the delta (direction + magnitude + previous rank) into
  `ResultEmailData` and render a localized "you moved up N to #X" line in the
  result email (HTML + plain text), reusing the existing standing section's
  visual language. No movement and first-ever rank degrade gracefully.
- Add the rank-delta i18n keys to the `email` namespace in all four locales
  (en, es, fr, de).

## Capabilities

### New Capabilities

- `rank-change-notification`: surface a player's overall-leaderboard rank delta
  (direction, magnitude, previous rank) in the post-result email after scores
  recompute, driven by a pre-recompute rank snapshot.

### Modified Capabilities

## Impact

- DB: new migration adding a `leaderboard_rank_snapshot` table (service-role
  only, RLS enabled with no policies, like `result_email_log`).
- Code: `app/api/cron/sync-matches/route.ts` (snapshot step before sync),
  `lib/notifications/result-emails.ts` (compute + thread delta),
  `lib/notifications/result-email-template.ts` (`RankDelta` type + render),
  `messages/{en,es,fr,de}.json` (`email` namespace keys).
- The admin force-resend path (`forceDispatchResultEmails`) renders without a
  delta (no fresh snapshot for an ad-hoc resend) — graceful, not an error.
