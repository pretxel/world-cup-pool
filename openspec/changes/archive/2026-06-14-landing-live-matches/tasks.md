## 1. Data layer

- [x] 1.1 Read `node_modules/next/dist/docs/` for the current route-handler + client-component conventions before writing code
- [x] 1.2 Add `lib/matches/live.ts` with a `Fixture` type and a `getLiveAndNextUp(competitionId)` helper that queries the `matches` table via `createServerSupabaseClient()`
- [x] 1.3 Implement live selection (`status = "live"` OR `kickoff_at <= now` and status not `final`/`cancelled`) and next-up selection (soonest `scheduled` with `kickoff_at > now`), ordered by `kickoff_at`, scoped to the active competition
- [x] 1.4 Exclude unresolved placeholder fixtures from next-up (reuse the `flagSlug`/`looksLikeRealFixture` check)

## 2. Polling endpoint

- [x] 2.1 Add `app/api/live-matches/route.ts` GET handler returning `{ live, nextUp }` from `getLiveAndNextUp`, scoped to the active competition (`getActiveCompetition()`)
- [x] 2.2 Set `Cache-Control: no-store` (or short `s-maxage`) and handle the no-active-competition / error cases gracefully (empty payload)
- [x] 2.3 Verify the endpoint with `curl` for live, between-kickoffs, and pre-tournament states

## 3. Live list component

- [x] 3.1 Add `components/live-match-list.tsx` (`"use client"`) accepting `initialData` and rendering live fixtures: teams + `TeamFlag`, score, `MatchStateBadge status="live"`, each row a `next/link` to the match page
- [x] 3.2 Render the next-up fallback with `KickoffCountdown` when there are no live fixtures
- [x] 3.3 Implement the 30s polling loop against `/api/live-matches` with `AbortController`, `visibilitychange` pause/resume + immediate refetch, and stop-when-idle logic
- [x] 3.4 Add `aria-live="polite"` on the score region and ensure the list is keyboard- and screen-reader-accessible

## 4. Wire into the landing section

- [x] 4.1 In `components/tournament-countdown.tsx`, fetch initial `{ live, nextUp }` server-side in the live branch and render `<LiveMatchList initialData=... />` below the live pill
- [x] 4.2 Keep the pre-tournament countdown branch unchanged

## 5. i18n

- [x] 5.1 Add new `home` keys (live heading, next-up / no-match copy, per-fixture labels) to `messages/en.json`
- [x] 5.2 Mirror the keys in `messages/es.json` and `messages/fr.json` with translations
- [x] 5.3 Confirm no hardcoded user-facing strings remain in the new components

## 6. Verify

- [x] 6.1 Manually verify on `/` (and a non-default locale): live list with multiple matches, next-up fallback, pre-tournament countdown, and score auto-refresh
- [x] 6.2 Confirm polling pauses on hidden tab, resumes on focus, and stops when nothing is live; no console errors / hydration warnings
- [x] 6.3 Run lint/typecheck and the test suite
