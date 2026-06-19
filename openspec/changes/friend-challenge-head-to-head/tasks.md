# Tasks — Friend Challenge Head-to-Head

## 1. Share plumbing & data helpers (read-only foundation)
- [ ] 1.1 Add `buildH2HPath(locale, idA, idB)` to `lib/share.ts` that canonicalizes the two `user_id`s (lexicographic sort) and returns `localePath(locale, /h2h/<first>/<second>)`; add a `canonicalH2HPair(idA, idB)` helper it shares.
- [ ] 1.2 Add `lib/h2h.ts` with a read-only `loadH2HStandings(supabase, idA, idB)` that reads both rows from `v_leaderboard_overall` (rank, display_name, total_points, exact_hits) and returns `null` when either is missing.
- [ ] 1.3 In `lib/h2h.ts`, add `loadRecentForm(supabase, userId, limit = 5)` selecting the latest `scores` rows by `computed_at desc`, mapping `hit_type` to hit/miss pips; reuse it for both players (two scoped queries are acceptable for two users).
- [ ] 1.4 Add an `h2h` i18n namespace (page eyebrow/heading, VS label, stat labels reused from `shareRank`/`leaderboard` where possible, share text, CTA) to the message catalogs for all supported locales.

## 2. OG card route
- [ ] 2.1 Create `app/api/og/h2h/route.tsx` modeled on `app/api/og/rank/route.tsx`: Node runtime (`dynamic = "force-dynamic"`), cookie-less `createClient`, read both standings + recent form, `404` on missing user.
- [ ] 2.2 Bump/extend the card version token (e.g. `h2h-1`) and compute the ETag over both players' `[rank, name, points, exact, form]` + `locale`; short-circuit `304` via `ifNoneMatchSatisfied`/`notModified`; set `OG_CACHE_CONTROL`.
- [ ] 2.3 Render the two-column "VS" scoreboard (duplicate the `Stat` layout left/right with a center divider and per-side form pips) using `loadOgFonts` + `loadDisplayNameFallback` for both display names.

## 3. Landing page
- [ ] 3.1 Create `app/[locale]/(public)/h2h/[a]/[b]/page.tsx`: SSR via `createServerSupabaseClient`, call `loadH2HStandings` + `loadRecentForm`, `notFound()` when either player is missing.
- [ ] 3.2 Redirect to the canonical order when the incoming `[a]/[b]` order is not canonical (using `canonicalH2HPair`).
- [ ] 3.3 Implement `generateMetadata` with OG/Twitter `summary_large_image` images pointing at `/api/og/h2h`, plus `robots: { index: false, follow: false }`.
- [ ] 3.4 Render the side-by-side scoreboard UI (mirror the `/share/rank` scoreboard styling) and a `ShareButtons` block with `context: "h2h"` and a "back to leaderboard" CTA.
- [ ] 3.5 Add `app/[locale]/(public)/h2h/[a]/[b]/loading.tsx` mirroring the existing share `loading.tsx` skeletons.

## 4. Leaderboard challenge entry point
- [ ] 4.1 Add a "Challenge" affordance for the signed-in viewer on the leaderboard (per-row or panel) that builds `${env.siteUrl}${buildH2HPath(locale, me, them)}` against a chosen listed player and feeds it into `ShareButtons` (`context: "h2h"`), without altering the existing realtime/segment logic.

## 5. Analytics
- [ ] 5.1 Add a client `H2HViewTracker` (mirroring `LeaderboardViewTracker`) emitting `trackEvent("h2h_view", …)` on the landing page.
- [ ] 5.2 Confirm the challenge affordance emits `share_click` with `context: "h2h"` (via `ShareButtons`) and add a `trackEvent` for challenge-link creation if surfaced separately.

## 6. Tests
- [ ] 6.1 Unit-test `buildH2HPath` / `canonicalH2HPair` order-independence and `loadRecentForm` hit/miss classification.
- [ ] 6.2 Add a route/render test for `/api/og/h2h` covering the 200, 304 (matching `If-None-Match`), and 404 (missing user) paths.
- [ ] 6.3 Add a landing-page test for the canonical redirect and `notFound` on a missing player.

## 7. Optional follow-up phase (deferred — NOT baseline)
- [ ] 7.1 (Optional) Add a `head_to_head_form` RPC migration (single round-trip recent form via `DISTINCT ON`/window function) and switch `loadRecentForm` to it if profiling warrants. **Migration task — only if this phase is taken.**
- [ ] 7.2 (Optional) Add a `head_to_head` log/analytics table + migration to persist created challenges (who/whom/when). **Migration task — only if this phase is taken.**

## 8. Verification
- [ ] 8.1 Run `openspec validate "friend-challenge-head-to-head"` and ensure it passes.
- [ ] 8.2 Lint, typecheck, and run the test suite; verify the OG card unfurls correctly in a social debugger and the canonical redirect works for reversed URLs.
- [ ] 8.3 Confirm no writes to `scores`/leaderboard occur (read-only) and that the page is `noindex`.
