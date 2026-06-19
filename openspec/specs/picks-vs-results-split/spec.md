# Picks vs. Results Split

## Purpose

A personal split-screen comparison of a player's predictions against the real
tournament — per match and per group — plus a reusable standing-cards summary
surfaced on `/my-picks` and the signed-in landing. The comparison is
presentational and read-only; it never recomputes or writes competitive scoring.

## Requirements

### Requirement: Per-match picks vs. results comparison on My Picks

The `/my-picks` page SHALL present, for each of the player's predictions, the
player's predicted scoreline beside the real match result and the awarded score,
so the player can compare their pick against reality at a glance. The comparison
SHALL be read-only and MUST NOT recompute or write any competitive scoring.

#### Scenario: Final match shows pick beside real result

- **WHEN** a player views `/my-picks` and one of their predicted matches has
  `status = "final"` with both `home_score` and `away_score` recorded
- **THEN** the row shows the player's pick `home_goals–away_goals` next to the
  real result `home_score–away_score` and the awarded points and `hit_type` from
  the `scores` row for that match

#### Scenario: Unfinished match shows pick without a result

- **WHEN** a player views `/my-picks` and a predicted match is not yet `final`
  (scheduled, locked, live, or cancelled)
- **THEN** the row shows the player's pick and the match state, and the result
  side shows a pending state rather than a `0–0` scoreline or any awarded points

### Requirement: Group standings split — my picks vs. real results

The `/my-picks` page SHALL render the player's simulated group tables (built from
their predictions via `simulateAllGroups`) alongside the real, results-derived
group tables (built from actual `final` results via `getGroupTables`), reusing
the existing group-standings table component for both sides. The two sides MUST
use the standard 3/1/0 football points engine and MUST NOT be conflated with
competitive prediction scoring.

#### Scenario: Both columns render for a competition with a group stage

- **WHEN** the active competition has a group stage and the player views
  `/my-picks`
- **THEN** the page shows a "my picks" group table (source `picks`) and a "real
  results" group table (source `results`) for each group, side by side on wide
  screens and stacked on mobile

#### Scenario: No group stage hides the split

- **WHEN** the active competition has no group stage (or none is active) so
  `getGroupTables()` returns `hasGroupStage: false`
- **THEN** the group-standings split is omitted and no error is shown

### Requirement: Standing cards summary

The system SHALL provide a reusable standing-cards component, fed by one shared
read-only summary helper, that reports the player's total points, exact-pick
count, total picks, current overall rank, rank delta since the last snapshot, and
a finals accuracy breakdown (counts of exact / winner / miss over `final`
matches). The helper MUST read only existing tables and views (`scores`,
`v_leaderboard_overall`, `leaderboard_rank_snapshot`) and MUST NOT write any
data.

#### Scenario: Cards show points, rank, and rank delta

- **WHEN** a signed-in player with at least one scored pick and a current row in
  `v_leaderboard_overall` and a baseline in `leaderboard_rank_snapshot` is shown
  the standing cards
- **THEN** the cards display total points, exact count, current rank, and a rank
  delta computed as `previousRank - currentRank` (positive indicating the player
  climbed)

#### Scenario: Missing snapshot omits the delta

- **WHEN** a player has no row in `leaderboard_rank_snapshot` (e.g. first sync or
  unranked)
- **THEN** the standing cards render the available stats without a rank delta and
  without throwing

#### Scenario: Finals accuracy counts only completed matches

- **WHEN** the standing summary computes the accuracy breakdown
- **THEN** it counts only matches that are `final` with both scores present and a
  matching `scores` row, so the breakdown agrees with the per-match badges and
  excludes unplayed fixtures

### Requirement: Standing cards on the signed-in landing

The landing page SHALL render the standing cards for signed-in visitors above
the marketing hero, and SHALL leave the anonymous landing render path unchanged.

#### Scenario: Signed-in visitor sees standing cards on the landing

- **WHEN** a signed-in player visits the landing `/`
- **THEN** the real standing cards (their points, rank, delta, finals accuracy)
  are shown, replacing the static demo scoreboard for that visitor

#### Scenario: Anonymous visitor sees the marketing landing unchanged

- **WHEN** a visitor with no session visits the landing `/`
- **THEN** the existing marketing hero and demo scoreboard render with no authed
  query and no behavioral change

### Requirement: Localization and analytics for the split

All new labels and empty states introduced by the split and standing cards SHALL
be localized in the `en`, `es`, `fr`, and `de` message catalogs, and the views
SHALL emit analytics events through the existing `trackEvent` mechanism so the
bet is measurable.

#### Scenario: New strings exist in every supported locale

- **WHEN** the split view or standing cards render in any of `en`, `es`, `fr`,
  `de`
- **THEN** every visible label and empty-state string resolves from that
  locale's catalog with no missing-key fallback

#### Scenario: Views emit analytics events

- **WHEN** the picks-vs-results split or the standing cards become visible to a
  signed-in player
- **THEN** a `picks_vs_results_viewed` (split) and a `standing_cards_viewed`
  (cards) event are sent via the existing `trackEvent` client tracker
