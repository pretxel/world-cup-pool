## ADDED Requirements

### Requirement: setMatchResult guarantees a score recompute on every save

The `setMatchResult` server action SHALL invoke the `compute_match_scores(p_match_id)` Postgres function after a successful match UPDATE, on every save — even when no column value changed. This guarantees `public.scores` is rebuilt from current `predictions` and `matches.home_score`/`away_score`/`status` regardless of whether the DB row-change trigger fired.

#### Scenario: First-time final save
- **WHEN** an admin saves a match with `status = 'final'`, valid `home_score` and `away_score`, and no prior score rows exist for the match
- **THEN** the action calls `compute_match_scores(match_id)` after the UPDATE
- **AND** `public.scores` contains one row per existing prediction for that match with `points` and `hit_type` computed against the match's final score

#### Scenario: Re-saving the same final values
- **WHEN** an admin saves a match with `status = 'final'` and the exact same `home_score`/`away_score` as the existing row
- **THEN** the row-change DB trigger does not fire (no column changed)
- **AND** the action still calls `compute_match_scores(match_id)`
- **AND** `public.scores` rows for that match are replaced with freshly computed rows

#### Scenario: Non-final save
- **WHEN** an admin saves a match with `status` other than `'final'` (e.g. `'scheduled'`, `'live'`, `'cancelled'`)
- **THEN** the action still calls `compute_match_scores(match_id)`
- **AND** `public.scores` rows for that match are cleared and no new rows are inserted (matching `compute_match_scores`'s documented behavior for non-final matches)

#### Scenario: RPC failure surfaces
- **WHEN** the `compute_match_scores` RPC returns an error
- **THEN** the action throws an `Error` with the RPC error message
- **AND** the failure is visible in the admin UI as a thrown error from the server action

### Requirement: my-picks revalidates after a result save

The `setMatchResult` server action SHALL revalidate the `/my-picks` path after each save so authenticated users see updated points and hit types on their next view of that page.

#### Scenario: Cache invalidation on save
- **WHEN** an admin saves any match result via `setMatchResult`
- **THEN** Next.js revalidates `/my-picks` in addition to `/matches/[matchId]`, `/matches`, and `/leaderboard`
