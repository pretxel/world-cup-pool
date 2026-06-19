# segmented-leaderboard Specification

## Purpose

The public `/leaderboard` exposes overall, this-week, and by-stage segments selected through `?segment=` (and `?stage=` for the stage segment). Each segment ranks the active competition's non-admin players over the segment's matches using the same scoring columns and tie-breakers as the overall board, giving mid-tier players a short-horizon, reachable competition that resets as the tournament progresses.

## Requirements

### Requirement: Leaderboard exposes overall, week, and stage segments via the URL

The `/leaderboard` page SHALL support a `segment` query parameter with the values `overall`, `week`, and `stage`. The `overall` segment SHALL be the default and SHALL render the all-time ranking from `v_leaderboard_overall`, identical to the behavior when no `segment` parameter is present. The `week` segment SHALL render a ranking restricted to matches whose `kickoff_at` falls in the current week. The `stage` segment SHALL render a ranking restricted to a single tournament stage selected by a `stage` query parameter. Each non-overall segment SHALL be sourced from a SQL function that aggregates the same score columns (`total_points`, `exact_hits`, `winner_gd_hits`, `winner_hits`, `rank`) with the same tie-breakers as `v_leaderboard_overall`, scoped to `active_competition_id()` and excluding admin accounts.

#### Scenario: Default visit renders overall
- **WHEN** a visitor opens `/leaderboard` with no query parameters
- **THEN** the page renders the all-time ranking from `v_leaderboard_overall`
- **AND** the overall segment is shown as active in the segment switcher

#### Scenario: Explicit overall segment matches the default
- **WHEN** a visitor opens `/leaderboard?segment=overall`
- **THEN** the page renders the same all-time ranking as the bare `/leaderboard` URL

#### Scenario: Week segment ranks only this week's matches
- **WHEN** a visitor opens `/leaderboard?segment=week`
- **THEN** the ranking reflects only scores for matches whose `kickoff_at` is within the current week
- **AND** rows use the same point, exact, winner+GD, wins, and rank columns as the overall board

#### Scenario: Stage segment ranks only the chosen stage
- **WHEN** a visitor opens `/leaderboard?segment=stage&stage=r16`
- **THEN** the ranking reflects only scores for matches whose `stage` is `r16`
- **AND** rows use the same columns and tie-breakers as the overall board

#### Scenario: Segments exclude other competitions and admins
- **WHEN** any non-overall segment is rendered
- **THEN** the ranking includes only the active competition's matches
- **AND** admin accounts are absent and the remaining ranks are contiguous

### Requirement: Invalid or missing segment parameters fall back to overall

The page SHALL treat an unknown `segment` value, a `segment=stage` request whose `stage` value is not one of the active competition's stage keys, or a missing `stage` for the stage segment, as a request for the `overall` segment. It SHALL NOT redirect or return a 404 for such URLs.

#### Scenario: Unknown segment value
- **WHEN** a visitor opens `/leaderboard?segment=bogus`
- **THEN** the page renders the overall ranking
- **AND** no redirect or error occurs

#### Scenario: Stage segment without a valid stage
- **WHEN** a visitor opens `/leaderboard?segment=stage` with no `stage` parameter, or `?segment=stage&stage=unknown`
- **THEN** the page renders the overall ranking
- **AND** no redirect or error occurs

### Requirement: Segment switcher is URL-driven and server-rendered

The page SHALL render a segment switcher offering Overall, This week, and By stage. Selecting a segment SHALL change the `segment` (and, for stage, the `stage`) query parameter so the active segment is encoded in the URL and shareable. The currently active segment SHALL be visually indicated. The switcher labels and stage names SHALL be localized in every supported locale (en, es, fr, de).

#### Scenario: Switching segments updates the URL
- **WHEN** a visitor selects the "This week" option from the switcher
- **THEN** the resulting URL carries `segment=week`
- **AND** the page renders the week ranking with "This week" indicated as active

#### Scenario: Stage selection encodes the stage
- **WHEN** a visitor chooses a specific stage from the by-stage control
- **THEN** the resulting URL carries `segment=stage` and that stage's key in `stage`

#### Scenario: Localized switcher
- **WHEN** the leaderboard renders in any supported locale (en, es, fr, de)
- **THEN** the segment labels and stage names are shown in that locale's translation

### Requirement: Top-10 cap, leader card, count, and share work per segment

For every segment, the standings table SHALL show at most the top 10 ranked players of that segment's field, while the leader card, the total player count, and a signed-in user's "your rank" share section SHALL reflect that segment's full ranked field. A segment with no scored matches SHALL render the existing empty state, not an error.

#### Scenario: Top-10 cap applies to the active segment
- **WHEN** the active segment's ranked field contains more than 10 players
- **THEN** the standings table renders exactly 10 rows for that segment, ranks 1 through 10
- **AND** the leader card and total count reflect that segment's full field

#### Scenario: Signed-in user's rank reflects the segment
- **WHEN** a signed-in user views a non-overall segment
- **THEN** the "your rank" share section shows that user's rank and points within that segment
- **AND** if the user has no scored matches in that segment, the share section is absent

#### Scenario: Empty segment shows the empty state
- **WHEN** a segment (for example `segment=stage&stage=final` before any final is played) has no scored matches
- **THEN** the page renders the existing empty-state copy
- **AND** no error is shown
