## Why

Every re-engagement nudge today is email-only: the `prediction-reminders`, `result-emails` (standing-changed), `quiz-reminders`, digests, and comeback crons all dispatch through Resend (`lib/notifications/*`, `app/api/cron/*`). análisis.md flags Web Push as the headline **apuesta grande** (sections 4 and 7): _"Push notifications para 'nuevo partido hoy sin predecir' y 'tu standing cambió' — el complemento real al email batch."_ Push reaches a player on the lock screen within seconds of a match needing a pick or their rank moving, instead of competing in an inbox an hour later. It is the highest-impact channel the app does not yet have.

The two triggers map directly onto computations the app already performs. "A match needs your pick today" is exactly the pending set produced by `computePendingPredictionReminders` in `lib/notifications/prediction-reminder-emails.ts` (today's confirmed, still-open matches a player has not predicted, local-7am-bucketed). "Your standing changed" is exactly the rank movement `result-emails.ts` already derives via `captureRankSnapshot` (`lib/notifications/rank-snapshot.ts`) + `computeRankDelta` against `v_leaderboard_overall`, fired from the `sync-matches` cron after a match finalizes. This change adds the delivery channel (a service worker, VAPID-signed Web Push, a `push_subscriptions` table, a subscribe UI, and a `web-push` send step woven into those existing dispatch paths) without re-deriving any of that audience logic.

This is a large infrastructure change, so it is phased: **(1)** subscribe plumbing (service worker, VAPID env, `push_subscriptions` table, subscribe UI, a `push` email-pref-style opt-in, a reusable sender), **(2)** the match-needed push (reuse the prediction-reminder pending set), **(3)** the standing-changed push (reuse the result-email rank-delta). Phases 2 and 3 are inert until phase 1 ships and a player subscribes.

## What Changes

- Add a new `public.push_subscriptions` table (Supabase migration) storing each browser's PushSubscription (`endpoint` unique, `p256dh`, `auth` keys, `user_id`, `user_agent`, `created_at`, `last_seen_at`, `failure_count`), RLS-enabled so a signed-in user can read/insert/delete only their own rows, with the cron send paths reading via the service-role admin client.
- Add VAPID configuration to `lib/env.ts`: a public key (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, client-readable) and a private key + subject (`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, server-only), all nullable so the build and every send path no-op cleanly when unset (mirroring the `resendApiKey`/`footballDataToken` posture).
- Add a public service worker (`public/sw.js`) that handles `push` and `notificationclick` events: shows the notification from the payload and focuses/opens the deep-link URL on click.
- Add a `push` email-pref-style opt-in key to `lib/email-prefs.ts` (`EMAIL_PREF_KEYS`, `DEFAULT_EMAIL_PREFS`, `emailPrefsSchema`, `normalizeEmailPrefs`) — default opted-IN — so the existing account-menu toggles (`components/user-menu.tsx`, which iterate `EMAIL_PREF_KEYS`) gate push delivery alongside the email types, with no new preference plumbing.
- Add a client subscribe component surfaced in `components/user-menu.tsx` (the existing prefs panel) that registers the service worker, requests notification permission, calls `pushManager.subscribe` with the VAPID public key, and persists the subscription via a new server action; plus an unsubscribe path that removes the row.
- Add a reusable server-only sender `lib/notifications/web-push.ts` (`sendWebPush`) wrapping the `web-push` library: signs with the VAPID keys, sends a JSON payload to a subscription, and reports `410 Gone` / `404` so the caller can prune dead subscriptions. No-ops when VAPID env is unset.
- Phase 2 — extend `lib/notifications/prediction-reminder-emails.ts` (or a thin sibling sharing `computePendingPredictionReminders`) so the prediction-reminders cron, after the email send, also sends a "you have N matches to predict today" push to each pending player's subscriptions, honoring the `push` opt-in and idempotent per player per UTC day via a push-specific ledger.
- Phase 3 — extend `lib/notifications/result-emails.ts` so the `sync-matches` cron, after the result-email send, also sends a "you moved {up/down} N to #{rank}" push to each affected player's subscriptions, reusing the already-computed `RankDelta`, honoring the `push` opt-in, idempotent per (match,user) via a push-specific ledger.
- Add a `pushNotifications` i18n namespace to `messages/{en,es,fr,de}.json` for the notification titles/bodies and the subscribe-toggle copy.

Non-goals: native iOS/Android apps or APNs/FCM (Web Push only); a generic in-app notification center or notification history UI; per-timezone push windows beyond the local-7am bucketing the prediction reminder already applies; push for quiz reminders, digests, or comeback; a separate push preference per trigger (a single `push` opt-in gates both); rich-media/image push payloads.

## Capabilities

### New Capabilities
- `push-notifications`: opt-in Web Push delivery for "a match needs your pick today" and "your standing changed", via a service worker, VAPID-signed `web-push`, and a per-browser `push_subscriptions` table written from a subscribe UI — sent alongside the existing email crons, gated on a `push` preference, and idempotent per-trigger per ledger.

### Modified Capabilities

## Impact

- **App**: new server action(s) to persist/remove a PushSubscription (alongside `app/[locale]/profile-actions.ts`, mirroring `updateEmailPrefs`). New static asset `public/sw.js` (service worker). The prediction-reminders and sync-matches cron routes gain a push send step (additive, isolated like the existing email steps — a failure is logged, never aborts the run). No new `vercel.json` cron entry: push rides the existing schedules.
- **Lib**: new `lib/notifications/web-push.ts` (reusable VAPID sender) and a pure payload/audience helper reused from the email dispatchers. Extends `lib/env.ts` with three VAPID vars and `lib/email-prefs.ts` with the `push` key. New dependency `web-push`.
- **Data**: one new table `public.push_subscriptions` (RLS: owner-only read/insert/delete) plus per-trigger push ledger column(s)/table(s) for idempotency (e.g. a `push_sent_at` discriminator on the existing reminder/result logs, or sibling `*_push_log` tables). Supabase migration required.
- **Infra**: a service worker registered in the browser, a Web Push subscription per browser, and VAPID keys as env vars — net-new infrastructure for the app. Generated once via `web-push generate-vapid-keys`.
- **Realtime / competitive scoring**: none. Push is a fire-and-forget batch send off the existing crons; it reads `v_leaderboard_overall`/`leaderboard_rank_snapshot` for the standing-changed copy but writes no score, rank, or competition data, so scoring fairness is untouched.
- **Dependency / caveat**: delivery requires the three VAPID env vars set in production and at least one stored subscription; with VAPID unset every send path no-ops (like `RESEND_API_KEY` unset for email). Web Push on iOS requires the site be installed to the Home Screen (PWA) — documented as a known platform limitation, not a blocker for desktop/Android.
