## 1. Phase 1 — Data: subscription store + push idempotency

- [x] 1.1 Add a Supabase migration under `supabase/migrations/` with a timestamped filename (e.g. `20260620<HHMMSS>_push_subscriptions.sql`) creating `public.push_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, endpoint text not null unique, p256dh text not null, auth text not null, user_agent text, created_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), failure_count int not null default 0)`.
- [x] 1.2 Add an index on `user_id`; enable RLS and add policies allowing a signed-in user to `select`/`insert`/`delete` only rows where `user_id = auth.uid()`; document that the cron send paths read across users via the service-role admin client.
- [x] 1.3 Add the push idempotency ledger: either a `channel`/`pushed_at` discriminator on `prediction_reminder_log` and `result_email_log`, or sibling `*_push_log` tables, keyed `(user_id, reminder_date)` and `(match_id, user_id)` respectively; RLS service-role-only, mirroring the existing email ledgers. Document the choice in a migration comment.

## 2. Phase 1 — VAPID env

- [x] 2.1 Add `vapidPublicKey` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`), `vapidPrivateKey` (`VAPID_PRIVATE_KEY`), and `vapidSubject` (`VAPID_SUBJECT`) to `lib/env.ts`, all nullable (`?? null`), with a comment noting the send paths no-op when unset (mirroring `resendApiKey`/`footballDataToken`).
- [x] 2.2 Generate VAPID keys (`npx web-push generate-vapid-keys`) and document the three env vars (local `.env`, Vercel prod). Do not commit keys.

## 3. Phase 1 — Service worker

- [x] 3.1 Add `public/sw.js` with a `push` listener that `event.waitUntil(self.registration.showNotification(title, { body, data: { url }, tag }))` reading `event.data.json()`, and a `notificationclick` listener that focuses an existing client on `data.url` or opens it. Do not intercept `fetch` or cache.

## 4. Phase 1 — Reusable sender

- [x] 4.1 Add the `web-push` dependency. Create `lib/notifications/web-push.ts` (`server-only`) configuring `web-push` with the VAPID keys once and exporting `sendWebPush(subscription, payload)`.
- [x] 4.2 No-op (return a skip result) when any VAPID env value is unset. On send, return a result distinguishing success from a `410 Gone`/`404` expired endpoint so callers can prune.

## 5. Phase 1 — Subscribe UI + server actions

- [x] 5.1 Add `push` to `EMAIL_PREF_KEYS`, `DEFAULT_EMAIL_PREFS` (default `true`), `emailPrefsSchema`, and `normalizeEmailPrefs` in `lib/email-prefs.ts`.
- [x] 5.2 Add `savePushSubscription(sub)` and `removePushSubscription(endpoint)` server actions alongside `updateEmailPrefs` in `app/[locale]/profile-actions.ts`, writing/deleting the caller's own `push_subscriptions` row under RLS (upsert on `endpoint`).
- [x] 5.3 In `components/user-menu.tsx`, when the `push` toggle turns on: register `/sw.js`, call `Notification.requestPermission()`, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <NEXT_PUBLIC_VAPID_PUBLIC_KEY> })`, then `savePushSubscription`. When it turns off (or permission denied/unsupported): `removePushSubscription` and set the pref false; leave the toggle off on denial.
- [x] 5.4 Detect unsupported browsers / denied permission and degrade gracefully (toggle stays off, optional hint); handle iOS Home-Screen-install limitation in copy.

## 6. Phase 2 — Match-needed push (prediction-reminders cron)

- [x] 6.1 Extend `lib/notifications/prediction-reminder-emails.ts` (or a sibling sharing `computePendingPredictionReminders` + `filterRecipientsAtLocalHour`) so after the email send it sends a match-needed push to each pending, `push`-opted-in player with subscriptions; gate with `isOptedIn(prefs, "push")`.
- [x] 6.2 Build the payload from the `pushNotifications` namespace (title/body, e.g. "{n} matches need your pick today"), `url = ${siteUrl}${localePath(DEFAULT_LOCALE, "/matches?picks=needed")}`; send via `sendWebPush`; prune endpoints that return `410`/`404`.
- [x] 6.3 Make it idempotent per player per UTC day via the push ledger (write only after a successful send); isolate the whole push step so a failure is logged and never affects the email summary. The cron route (`app/api/cron/prediction-reminders/route.ts`) needs no structural change beyond the dispatcher producing/logging a push count.

## 7. Phase 3 — Standing-changed push (sync-matches cron)

- [x] 7.1 Extend `lib/notifications/result-emails.ts` so the cron path, after the result-email send, sends a standing-changed push to each affected, `push`-opted-in player with subscriptions, reusing the already-computed `RankDelta` + new rank (no new rank computation); gate with `isOptedIn(prefs, "push")`.
- [x] 7.2 Build the payload from the `pushNotifications` namespace (e.g. "You moved up {n} to #{rank}"), `url = ${siteUrl}${localePath(DEFAULT_LOCALE, "/leaderboard")}`; send via `sendWebPush`; prune endpoints that return `410`/`404`.
- [x] 7.3 Make it idempotent per `(match, user)` via the push ledger (write only after a successful send); for an unchanged rank either suppress or send neutral copy but still record idempotency. Isolate the push step so a failure is logged and never aborts the sync or result-email send (mirroring the existing isolated steps in `app/api/cron/sync-matches/route.ts`).

## 8. i18n

- [x] 8.1 Add a `pushNotifications` namespace to `messages/en.json` (match-needed title/body, standing-changed title/body) and the `push` toggle label under the `emailPrefs` toggle copy.
- [x] 8.2 Mirror the namespace and toggle label in `messages/es.json`, `messages/fr.json`, and `messages/de.json`.

## 9. Verification

- [x] 9.1 Run typecheck (`tsc --noEmit` / project typecheck script) — no errors.
- [x] 9.2 Run lint — no new violations.
- [x] 9.3 Add/run unit tests: the `sendWebPush` no-op when VAPID unset and its `410`/`404` prune-signal; the `push` opt-in filter (drops `push:false`, keeps default/null/non-boolean); reuse of `computePendingPredictionReminders` and `computeRankDelta` for the push audiences; the push ledger idempotency (no second push same UTC day / same match).
- [x] 9.4 Manual check (phase 1): with VAPID set, toggle push on in the account menu, confirm a `push_subscriptions` row is written, send a test push, and confirm the service worker shows it and the click opens the deep link.
- [x] 9.5 Manual check (phases 2–3): run the prediction-reminders cron with a pending player subscribed and confirm exactly one match-needed push (and none on the next hourly run that day); finalize a match and confirm one standing-changed push to an affected subscribed player (and none on a sync re-run).
- [x] 9.6 Confirm an opted-out player (`email_prefs.push = false`) receives no push, an expired endpoint is pruned, and every send path no-ops cleanly when VAPID env is unset.
