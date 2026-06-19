# Picks vs. Results Split

## Why

Today a player's predictions and the real tournament live in separate, mostly
read-only surfaces. `/my-picks` lists each pick with its score badge and a
simulated "what if my picks came true" group table (`simulateAllGroups`), while
the real, results-derived group tables live behind `getGroupTables()` /
`buildGroupTables` and the `/leaderboard` shows competitive standing. The two
never sit side by side, and the authenticated landing has no personal standing
surface at all — `app/[locale]/page.tsx` is a marketing page with a *static*
demo scoreboard (hard-coded "2 – 1 / +5 / ↑12").

`análisis.md` flags this as the "Vista split-screen: Mis Picks vs. Resultados
reales + tarjetas de standing en home/dashboard" big bet (§4 Apuestas grandes,
§7 largo plazo). The payoff is an emotional, at-a-glance "how am I doing vs.
reality" moment that turns passive score-checking into a returning habit, and
puts the player's live standing (with the rank delta we already snapshot) on the
first screen they see when signed in.

This is deliberately UI-heavy and reuses subsystems that already shipped: the
pure scoring/standings engines (`lib/scoring.ts`, `lib/group-standings.ts`),
real results from `matches.home_score/away_score` via `lib/group-table.ts`, the
`scores` table, the segmented leaderboard RPCs (`leaderboard_for_window`,
`leaderboard_for_stage`, `v_leaderboard_overall`), and the rank-delta baseline in
`leaderboard_rank_snapshot`. No schema change is required.

## What Changes

- Add a **split view on `/my-picks`** that pairs each scored pick with the real
  result (already partly there for `final` matches) and pairs the user's
  simulated group tables (`StandingsSource = "picks"`) against the real
  results-derived tables (`StandingsSource = "results"`) from `getGroupTables()`,
  reusing the existing `group-standings-table` component for both columns.
- Add **standing cards** (a dashboard-style strip) rendered on `/my-picks` and,
  for signed-in visitors, on the landing `app/[locale]/page.tsx`: total points,
  exact count, current overall rank + rank delta (from the snapshot baseline),
  and a "picks vs. results" accuracy summary (how many finals you got exact /
  winner / missed).
- Make the standing cards a **shared, reusable server component** so the same
  data shape feeds both the landing (signed-in) and `/my-picks` without
  duplicating the queries.
- Add **i18n strings** for the new split labels and standing cards across the
  four message catalogs (`en`, `es`, `fr`, `de`) and **analytics events**
  (reuse the existing `trackEvent` quick-win) for "viewed split" and "viewed
  standing cards", so the bet is measurable.
- Keep competitive scoring untouched: the comparison is presentational only;
  it reads `scores`, `v_leaderboard_overall`, and `matches` results and never
  recomputes or writes points.

## Capabilities

### New Capabilities

- `picks-vs-results-split`: a personal split-screen comparison of a player's
  predictions against the real tournament (per-match and per-group), plus a
  reusable standing-cards summary surfaced on `/my-picks` and the signed-in
  landing.

### Modified Capabilities

## Impact

- **Routes/UI:** `app/[locale]/(app)/my-picks/page.tsx` (split layout + cards),
  `app/[locale]/page.tsx` (signed-in standing cards), new shared
  `components/standing-cards.tsx` and a `components/picks-vs-results.tsx`
  comparison block.
- **Libs reused (no new engine):** `lib/scoring.ts`, `lib/group-standings.ts`,
  `lib/group-table.ts`, `lib/leaderboard-segment.ts`,
  `lib/notifications/rank-snapshot.ts` baseline table.
- **Data read-only:** `predictions`, `scores`, `matches` (results),
  `v_leaderboard_overall`, `leaderboard_rank_snapshot`. No migration, no new
  RPC, no realtime, no cron, no push/VAPID.
- **i18n:** new keys in `messages/{en,es,fr,de}.json`.
- **Analytics:** new `trackEvent` calls only.
- **Competitive scoring:** unaffected (display-only).
