# Tasks — Picks vs. Results Split

No database migration is required: this change is read-only over existing
tables/views (`predictions`, `scores`, `matches`, `v_leaderboard_overall`,
`leaderboard_rank_snapshot`). No new RPC, view, realtime channel, cron, or push
infra.

## 1. Standing summary data (shared, read-only)

- [x] 1.1 Add `lib/standing-summary.ts` exporting a `getStandingSummary(userId)`
      server helper that returns a typed `StandingSummary` (totalPoints,
      exactCount, totalPicks, finals accuracy counts by `hit_type`, current
      `rank`, `rankDelta | null`).
- [x] 1.2 Source totals from `scores` (points, exact count) and total picks from
      `predictions`, reusing the existing query shape on `/my-picks`.
- [x] 1.3 Read current rank from `v_leaderboard_overall` (row by `user_id`) and
      previous rank from `leaderboard_rank_snapshot`; compute
      `rankDelta = previousRank - currentRank`, or `null` when no snapshot row
      exists.
- [x] 1.4 Gate the finals accuracy breakdown on `status = "final"` with both
      scores present and a matching `scores` row, so it agrees with per-match
      badges.
- [x] 1.5 Unit-test the pure summary derivation (delta sign, missing-snapshot
      null, finals-only gating) with no DB.

## 2. Standing cards component

- [x] 2.1 Add `components/standing-cards.tsx` — presentational, mobile-first,
      accessible — rendering points, exact count, rank + delta badge (↑/↓/—), and
      a finals accuracy strip (exact / winner / miss) from `StandingSummary`.
- [x] 2.2 Add empty/partial states ("results appear as matches finish",
      no-delta) reusing existing card/empty-state styling.
- [x] 2.3 Add a client `StandingCardsTracker` that fires `standing_cards_viewed`
      via the existing `trackEvent`, mirroring `LeaderboardViewTracker`.

## 3. My Picks split view

- [x] 3.1 Render the standing cards at the top of
      `app/[locale]/(app)/my-picks/page.tsx` using `getStandingSummary`.
- [x] 3.2 Strengthen the per-match rows into a pick-vs-result comparison: pick
      scoreline beside real `home_score–away_score` for `final` matches, with a
      pending state otherwise (no `0–0`, no phantom points).
- [x] 3.3 Add `components/picks-vs-results.tsx` (or extend the existing groups
      block) to render the simulated group tables (source `picks`,
      `simulateAllGroups`) beside the real tables (source `results`,
      `getGroupTables().groups`) using `group-standings-table`; side-by-side on
      wide screens, stacked on mobile.
- [x] 3.4 Hide the group split when `hasGroupStage` is false; keep the empty
      states for partially-played tournaments.
- [x] 3.5 Add a client `PicksVsResultsTracker` firing `picks_vs_results_viewed`.

## 4. Signed-in landing standing cards

- [x] 4.1 In `app/[locale]/page.tsx`, resolve `supabase.auth.getUser()`; for
      signed-in visitors render the standing cards (via `getStandingSummary`)
      above the hero, replacing the static demo scoreboard for that visitor.
- [x] 4.2 Leave the anonymous render path untouched (no authed query, demo
      scoreboard unchanged) to preserve SEO/perf.

## 5. Localization

- [x] 5.1 Add all new keys (split labels: "my picks" / "real results" / pending;
      card labels; finals-accuracy labels; empty states) under the `myPicks` and
      a new `standingCards` namespace in `messages/en.json`.
- [x] 5.2 Mirror every key in `messages/es.json`, `messages/fr.json`,
      `messages/de.json`.

## 6. Verification

- [x] 6.1 Confirm no schema/RPC/realtime/cron/push change was introduced (search
      `supabase/migrations` is untouched by this change).
- [x] 6.2 Verify the split and cards are read-only: no writes to `scores`,
      `predictions`, `leaderboard_rank_snapshot`; no scoring recompute.
- [x] 6.3 Manually verify across `en/es/fr/de`: no missing-key fallbacks; empty,
      partial, and full-tournament states; signed-in vs. anonymous landing.
- [x] 6.4 Verify responsive/mobile-first layout and accessibility (semantic
      headings, table headers, contrast) for cards and the two-column split.
- [x] 6.5 Run lint/typecheck and the standing-summary unit tests; run
      `openspec validate "picks-vs-results-split"`.
