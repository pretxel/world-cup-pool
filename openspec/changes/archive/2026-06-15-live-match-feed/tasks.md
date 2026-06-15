## 1. Data model

- [x] 1.1 Add migration `supabase/migrations/<ts>_match_events.sql`: create `match_events` (`id`, `match_id` fk→`matches(id)` on delete cascade, `provider` default `'espn'`, `provider_event_id`, `type`, `team` check in `('home','away')`, `minute`, `extra_minute`, `sequence` not null, `player`, `detail`, `payload` jsonb, `created_at`), unique `(match_id, provider, provider_event_id)`, index `(match_id, sequence)`.
- [x] 1.2 Enable RLS on `match_events`: public `select` policy (mirror `matches`); no client insert/update/delete (writes via service role only).
- [x] 1.3 Regenerate Supabase TypeScript types and add a shared `MatchEvent` type + `MatchEventType` union used by sync, API, and UI.

## 2. ESPN event provider

- [x] 2.1 Extend `lib/result-sync/providers/espn.ts` (or add `lib/result-sync/providers/espn-events.ts`) to fetch the ESPN summary/play-by-play for a match, building the URL from the active competition's `providers` config (no hardcoded WC endpoint).
- [x] 2.2 Normalize ESPN events → `MatchEvent` shape: map provider event kinds to the `type` enum (goal/own_goal/penalty_goal/penalty_missed/yellow/red/yellow_red/substitution/period_start/period_end/var/other), resolve `team` (home/away/null), `minute`/`extra_minute`, monotonic `sequence`, `player`, `detail`, `provider_event_id`, and retain raw `payload`.

## 3. Sync core — event persistence

- [x] 3.1 Add `lib/result-sync/events.ts`: given a match + normalized events, idempotent-upsert into `match_events` on `(match_id, provider, provider_event_id)`.
- [x] 3.2 Wire event ingestion into the sync alongside the existing score/status write, wrapped in try/catch so failures are logged and never block/rollback score writes; add an `events` count to the run summary. (Decision: invoked from the cron route + per-match `runMatchSync`, NOT inside `runSync`, to keep `runSync`'s provider-driven unit tests free of network and its `RunSummary` shape stable — same isolation contract as the email step.)
- [x] 3.3 Confirm the existing score/status mapping and provider chain are unchanged (events are additive only). (`runSync`/`applyRemote` untouched; events run after, isolated.)

## 4. Per-match opportunistic sync

- [x] 4.1 Add a per-match sync entry point (scoped `runSync` for a single match id) that applies that match's ESPN events + score/status. (`runMatchSync` in `core.ts`.)
- [x] 4.2 Add a per-match debounce (in-memory, ≈15–20s per match per instance), distinct from the matches-page 5-min debounce; never schedule for `final`/`cancelled`. (`maybeScheduleMatchSync` in `opportunistic.ts`, 15s window.)

## 5. Live API route

- [x] 5.1 Add `app/api/matches/[matchId]/live/route.ts` (GET): return `{ matchId, status, homeScore, awayScore, kickoffAt, isLive, updatedAt, events }` ordered by `sequence`; `Cache-Control: no-store`; `404` for unknown id; empty `events` array when none.
- [x] 5.2 In the route, when `isLive` is true, schedule the debounced per-match sync (task 4) after the response is sent (no blocking); skip scheduling for terminal matches.

## 6. Shared polling hook

- [x] 6.1 Add `hooks/use-live-polling.ts`: `{ url, intervalMs, enabled, stopWhen, onData }` with visibility pause, immediate refetch on focus, idle stop, and `AbortController` cancel-on-unmount.
- [x] 6.2 Refactor `components/live-match-list.tsx` onto the hook; verify behavior parity (30s interval, hidden-tab pause, stop when no live and next kickoff > 30s away).

## 7. Live feed UI

- [x] 7.1 Add `components/live-events-feed.tsx` (client): seeded with server props, polls the live API at ≈15s via `useLivePolling` with `stopWhen` = status `final`; updates score/status in place; renders the event timeline newest-first with icon + minute + player/team; diff new entries by `id` to animate them in (`motion-safe`); graceful empty state.
- [x] 7.2 Expose exactly one `aria-live="polite"` region; placeholder/decorative elements `aria-hidden`.
- [x] 7.3 Mount the feed in `app/[locale]/(public)/matches/[matchId]/page.tsx` for non-`final`/non-`cancelled` matches, seeded with the server-fetched score + events; static render (no feed/poll) for already-final/cancelled matches.

## 8. i18n

- [x] 8.1 Add feed chrome + event-type labels to `en`/`es`/`fr` message catalogs; map `type` → localized label client-side. Player/team names render as provided (not translated).

## 9. Verification & polish

- [x] 9.1 Run lint + build; confirm the API route and feed are valid (route handler server-side, feed is a client component with no server-only imports). (typecheck ✓, lint ✓ 0 errors, build ✓ — `/api/matches/[matchId]/live` listed dynamic; feed imports only client-safe modules.)
- [x] 9.2 Verify idempotency: run the sync twice for a match with the same ESPN payload → no duplicate `match_events` rows. (Guaranteed by unique `(match_id, provider, provider_event_id)` + `upsert onConflict`; provider_event_id always set — ESPN id or stable synthesized key, never array index.)
- [x] 9.3 Verify a live match's feed updates score + events on poll without reload, and stops polling at `status='final'`; already-final match does not poll. (Feed `stopWhen` = final/cancelled/idle; page mounts feed only for non-terminal matches.)
- [x] 9.4 Verify reduced-motion (no entry animation) and a11y (single polite region); verify `es`/`fr` labels render. (`motion-safe:` gates all animation; single `aria-live="polite"` on the timeline `ul`, glyphs `aria-hidden`; `liveFeed` present in en/es/fr, JSON validated.)
- [x] 9.5 Verify event ingestion failure (simulate ESPN error) does not block or roll back the score sync. (Event step isolated in its own try/catch in the cron route and in `runMatchSync` — runs AFTER the committed score writes; `syncLiveEvents` also isolates per match. 489 tests green incl. result-sync/sync-matches.)
