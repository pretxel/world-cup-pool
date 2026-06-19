# Design — Picks vs. Results Split

## Context

The pieces this bet needs already exist; the work is composition and UI, not new
engines or data.

- **Per-match comparison** already lives on `/my-picks`
  (`app/[locale]/(app)/my-picks/page.tsx`): it loads the user's `predictions`
  with the embedded `matches!inner(*)`, loads `scores`
  (`match_id, points, hit_type`), builds a `scoreByMatch` map, and for `final`
  matches it already renders pick `home_goals–away_goals` next to the real
  `matches.home_score–away_score`. The split view is mostly a stronger layout of
  data already on the page.
- **Group standings** come from two pure, DB-free engines in
  `lib/group-standings.ts`: `simulateAllGroups(fixtures, predictionsByMatchId)`
  (the user's picks → a hypothetical table) and `buildGroupTables(matches)` (real
  `final` results → the actual table). The page already calls
  `simulateAllGroups`; `getGroupTables()` (`lib/group-table.ts`) returns the real
  side. Both yield the same `SimulatedGroup[]` shape, and the existing
  `components/group-standings-table.tsx` already takes a
  `StandingsSource = "picks" | "results"` prop — so a two-column split needs no
  new rendering primitive.
- **Standing data** is available without new queries: `scores` gives total
  points and exact count (already computed on the page), `v_leaderboard_overall`
  gives the user's current overall `rank`, and `leaderboard_rank_snapshot`
  (keyed `competition_id, user_id`, written by `captureRankSnapshot` before each
  sync) gives the previous-run rank to compute a delta — the same baseline the
  result emails use.
- **Landing** (`app/[locale]/page.tsx`) currently shows a *hard-coded* demo
  scoreboard. For signed-in visitors we replace nothing in the marketing flow;
  we prepend a real standing-cards strip above the hero CTA region.

## Goals / Non-Goals

**Goals:**

- A single `/my-picks` view where, per match and per group, the player sees
  *their pick* beside *the real result*, with the existing score/hit-type badges.
- A reusable standing-cards summary (points, exact count, overall rank + delta,
  finals accuracy breakdown) rendered identically on `/my-picks` and on the
  signed-in landing, fed by one shared server component / one data shape.
- Zero impact on competitive scoring: read-only over `scores`,
  `v_leaderboard_overall`, `matches`, and the snapshot baseline.
- Fully i18n'd (en/es/fr/de), responsive/mobile-first, accessible, and
  instrumented with the existing `trackEvent` analytics.

**Non-Goals:**

- No schema changes, no new migration, no new RPC, no new view.
- No realtime on this surface (the live leaderboard already exists at
  `/leaderboard`; the cards render at request time / SSR).
- No new email, cron, push notification, service worker, or VAPID infra.
- No new scoring rule, no rank-history backfill, no leaderboard rewrite.
- Not a replacement for `/leaderboard`; standing cards link to it, not duplicate
  its full table.

## Decisions

- **Reuse `group-standings-table` for both columns.** The component already
  accepts `StandingsSource`; render `simulateAllGroups(...)` ("picks") and
  `getGroupTables().groups` ("results") side by side, stacking to one column on
  mobile. No new table component.
- **One shared standing-cards component.** Create
  `components/standing-cards.tsx` as a presentational component taking a typed
  `StandingSummary` (points, exactCount, totalPicks, scoredFinals counts by
  hit_type, rank, rankDelta). A small server helper
  (`lib/standing-summary.ts`, read-only) assembles it from `scores`,
  `v_leaderboard_overall`, and `leaderboard_rank_snapshot`, so both the landing
  and `/my-picks` call one function. This avoids the page-duplication risk.
- **Rank delta from the existing snapshot only.** `rankDelta = previousRank -
  currentRank` (positive = climbed). If no snapshot row exists for the user
  (first run / unranked), render the card without a delta rather than guessing.
  No new history table is introduced for this bet.
- **Finals-only accuracy summary.** The "picks vs results" accuracy tiles count
  only matches that are `final` with both scores present and a row in `scores`
  (mirrors how `buildGroupTables` gates on `status === "final"`), so the numbers
  agree with the per-match badges and never reflect un-played fixtures.
- **Landing renders cards only when signed in.** The landing stays a static,
  cacheable marketing page for anonymous visitors; the standing strip is gated on
  `supabase.auth.getUser()` and degrades to the existing hero when absent. This
  keeps the public landing's render path unchanged for SEO/perf.
- **Analytics via existing `trackEvent`.** Emit `picks_vs_results_viewed` and
  `standing_cards_viewed` (client-side trackers, same pattern as the existing
  `LeaderboardViewTracker`), so the bet's impact is measurable against
  `análisis.md` §6 metrics.

## Risks / Trade-offs

- **No DB migration / no new infra.** This change adds no migration, no RPC, no
  view, no realtime channel, no cron job, and no push / service-worker / VAPID
  surface. It is read-only over existing tables and views.
- **Competitive-scoring impact: none.** The split and cards are display-only.
  They never call `compute_match_scores`, never write `scores`, and never alter
  ranking — the leaderboard and points remain the single source of truth.
- **Snapshot timing dependency.** Rank delta reflects the *last sync run's*
  baseline, not a per-day series; between syncs the delta is stable, which can
  read as "stale" right after a recompute. Accepted: it matches the result-email
  semantics players already see; a true daily series is a separate bet.
- **Landing render cost.** Adding an authed query to the landing risks slowing a
  hot page. Mitigation: the standing-summary helper runs a small, indexed read
  (one `scores` aggregate already loaded patterns elsewhere, one
  `v_leaderboard_overall` row by `user_id`, one snapshot row); it runs only for
  signed-in users and the anonymous path is untouched.
- **Empty / partial-tournament states.** Before any `final` match, the results
  column and finals-accuracy tiles are empty. We show explicit empty states
  ("results appear as matches finish") rather than zeros that look like losses,
  reusing the empty-state styling already in `group-standings-table` and
  `/my-picks`.
- **Wider-than-it-looks scope.** "Split-screen + cards on two surfaces + i18n ×4
  + analytics" is several deliverables. Tasks below phase it: cards helper first,
  then `/my-picks` split, then landing, then i18n/analytics/polish — so each
  phase is shippable on its own.
