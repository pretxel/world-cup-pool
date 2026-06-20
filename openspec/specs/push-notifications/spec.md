# push-notifications Specification

## Purpose
Opt-in Web Push delivery for the two highest-impact re-engagement triggers that were previously email-only: "a match needs your pick today" and "your standing changed". Push reaches a player on the lock screen within seconds, complementing the email crons rather than replacing them. It adds the delivery channel — a service worker, VAPID-signed `web-push`, a per-browser `push_subscriptions` store written from a subscribe UI, and a `push` opt-in in `email_prefs` — while reusing the existing prediction-reminder pending set and result-email rank delta verbatim, so no audience logic is re-derived. Sent alongside the existing `prediction-reminders` and `sync-matches` crons, gated on the `push` preference, idempotent per-trigger via push-specific ledgers, and fully dormant (every send path no-ops) until VAPID env is configured.

## Requirements

### Requirement: Web Push subscription store

The system SHALL persist each browser's Web Push subscription in a new table `public.push_subscriptions` with at least `user_id` (referencing `public.profiles(id)` with `on delete cascade`), a unique `endpoint text`, the `p256dh` and `auth` keys, an optional `user_agent`, `created_at`, `last_seen_at`, and a `failure_count`. The table SHALL have RLS enabled with policies allowing a signed-in user to `select`, `insert`, and `delete` only rows where `user_id = auth.uid()`. The cron send paths SHALL read subscriptions across all users via the service-role admin client. A subscription persisted with an `endpoint` that already exists SHALL upsert (not duplicate) on the unique `endpoint`.

#### Scenario: A subscription is stored for its owner

- **WHEN** a signed-in player completes the browser subscribe flow and the subscription is persisted
- **THEN** a `push_subscriptions` row exists with that player's `user_id`, `endpoint`, `p256dh`, and `auth`
- **AND** the player can read and delete that row under RLS, but cannot read another player's rows

#### Scenario: Re-subscribing the same browser does not duplicate

- **WHEN** the same browser endpoint is persisted again
- **THEN** the existing row is updated rather than a second row created, because `endpoint` is unique

### Requirement: VAPID configuration gates all sending

The system SHALL read VAPID configuration from `lib/env.ts`: a client-readable public key (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) and server-only private key + subject (`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), each nullable. Every push send path SHALL no-op (log and send nothing) when any required VAPID value is unset, mirroring the `RESEND_API_KEY`-unset behavior of the email dispatchers, so the build never crashes and the feature stays dormant until configured.

#### Scenario: VAPID not configured

- **WHEN** `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, or the public key is unset and a cron runs
- **THEN** the push step logs that it is skipping and sends no notification
- **AND** the email send and the run summary are unaffected

#### Scenario: VAPID configured

- **WHEN** all VAPID values are set and a player has an opted-in subscription
- **THEN** the push step signs and sends a notification to that subscription

### Requirement: Service worker receives and opens push notifications

The system SHALL serve a service worker at the origin root (`public/sw.js`, scope `/`) that handles the `push` event by displaying a notification built from the JSON payload (`title`, `body`, and a click-through `url`), and handles the `notificationclick` event by focusing an existing client on that `url` or opening it. The service worker SHALL NOT intercept `fetch` or cache responses.

#### Scenario: Push payload is shown

- **WHEN** the browser receives a push event carrying `{ title, body, url }`
- **THEN** the service worker displays a notification with that title and body

#### Scenario: Clicking the notification opens the deep link

- **WHEN** the player clicks a displayed notification
- **THEN** the service worker focuses an existing tab on the notification's `url` or opens a new one at that `url`

### Requirement: Opt-in subscribe flow gated by a push preference

The system SHALL add a `push` preference key to `lib/email-prefs.ts` (`EMAIL_PREF_KEYS`, `DEFAULT_EMAIL_PREFS`, `emailPrefsSchema`, `normalizeEmailPrefs`), defaulting to opted-IN, so the existing account-menu toggles in `components/user-menu.tsx` (which iterate `EMAIL_PREF_KEYS`) expose it without further wiring. Enabling the toggle SHALL register the service worker, request notification permission, call `pushManager.subscribe` with the VAPID public key, and persist the subscription via a server action; disabling it (or a denied permission) SHALL remove the stored subscription and set the preference to `false`. No push SHALL be sent to a player whose `email_prefs.push` is explicitly `false`, using the existing `isOptedIn` reader.

#### Scenario: Player opts in to push

- **WHEN** a player enables the push toggle and grants notification permission
- **THEN** the service worker is registered, a subscription is created with the VAPID public key, and a `push_subscriptions` row is persisted
- **AND** the `push` preference is recorded as `true`

#### Scenario: Player opts out of push

- **WHEN** a player disables the push toggle
- **THEN** the stored subscription is removed and `email_prefs.push` is set to `false`
- **AND** subsequent cron runs send that player no push

#### Scenario: Opted-out player is dropped from sends

- **WHEN** a cron's push step evaluates a player whose `email_prefs.push` is `false`
- **THEN** that player is excluded from the push send even if a subscription row still exists

#### Scenario: Permission denied or unsupported

- **WHEN** the browser denies notification permission or does not support Web Push
- **THEN** the toggle does not turn on and no subscription is created

### Requirement: Match-needed push alongside the prediction-reminders cron

The system SHALL, on the prediction-reminders cron run, after the existing email send, send a "matches need your pick today" push to each pending player who is `push`-opted-in and has at least one stored subscription. The pending set SHALL be the same set produced by `computePendingPredictionReminders` (and `filterRecipientsAtLocalHour`) used by the email path, so the audience is not re-derived. The push SHALL carry a deep-link `url` to the needs-pick matches view (`/matches?picks=needed`) and SHALL be idempotent per player per UTC day via a push-specific ledger, so the hourly cron never double-pushes. The push step SHALL be isolated: a failure SHALL be logged and SHALL NOT affect the email send or the run summary.

#### Scenario: Pending player with a subscription is pushed once per day

- **WHEN** a player has today-matches they have not predicted, is `push`-opted-in, has a subscription, and has not been pushed today
- **THEN** they receive one match-needed push linking to `/matches?picks=needed`
- **AND** a push ledger row is written so a later cron run the same day does not push again

#### Scenario: No pending matches means no push

- **WHEN** a player has predicted all of today's open matches (empty pending set)
- **THEN** no match-needed push is sent to that player

#### Scenario: Push failure does not break the email run

- **WHEN** the push send throws during the cron run
- **THEN** the error is logged, the email send and summary are unaffected, and the route still returns its normal response

### Requirement: Standing-changed push alongside the sync-matches cron

The system SHALL, on the sync-matches cron run, after a match finalizes and the result-email send, send a "your standing changed" push to each affected player who is `push`-opted-in and has at least one stored subscription. The push body SHALL be derived from the rank delta already computed by `computeRankDelta` against the pre-recompute `leaderboard_rank_snapshot` and the new rank from `v_leaderboard_overall` — no new rank computation. The push SHALL carry a deep-link `url` to the leaderboard and SHALL be idempotent per `(match, user)` via a push-specific ledger, so re-running sync-matches never re-pushes. The push step SHALL be isolated: a failure SHALL be logged and SHALL NOT abort the sync or the result-email send.

#### Scenario: Affected player with a movement is pushed once

- **WHEN** a match finalizes, a player's rank moved, the player is `push`-opted-in, and has a subscription
- **THEN** they receive one push describing the movement (e.g. "you moved up N to #X") linking to the leaderboard
- **AND** a push ledger row for that `(match, user)` is written so a re-run does not re-push

#### Scenario: Same rank produces no movement push

- **WHEN** a player's rank is unchanged after the recompute (`computeRankDelta` direction `same`)
- **THEN** the system MAY suppress the push or send the neutral standing copy, but SHALL still record idempotency so the player is not pushed again for that match

#### Scenario: Re-run does not re-push

- **WHEN** the sync-matches cron runs again for the same finalized match
- **THEN** players already recorded in the push ledger for that match receive no additional standing push

### Requirement: VAPID-signed sender prunes dead subscriptions

The system SHALL provide a server-only sender (`lib/notifications/web-push.ts`, `sendWebPush`) that signs a JSON payload (`title`, `body`, `url`, optional `tag`) with the VAPID keys and sends it to a subscription via the `web-push` library. When a send returns `410 Gone` or `404`, the caller SHALL prune that subscription (delete the row or increment `failure_count` and delete past a threshold) so the store does not accumulate dead endpoints. The sender SHALL no-op when VAPID env is unset.

#### Scenario: Expired subscription is pruned

- **WHEN** a send to a subscription returns `410 Gone` or `404`
- **THEN** that `push_subscriptions` row is removed (or its `failure_count` advanced and removed past the threshold)
- **AND** the remaining recipients in the run are still sent

#### Scenario: Successful send leaves the subscription intact

- **WHEN** a send succeeds
- **THEN** the subscription row is retained and its `last_seen_at` MAY be refreshed
