# leaderboard

## Purpose

Rules governing the public `/leaderboard` page — its scope, data source, and the surrounding copy across the marketing surface (homepage, how-it-works). The pool exposes a single overall ranking; no daily, weekly, or per-day views are surfaced to visitors.
## Requirements
### Requirement: Leaderboard exposes a single global scope

The `/leaderboard` page SHALL render a single overall ranking sourced from the `v_leaderboard_overall` view. It SHALL NOT expose a "Today" / "Daily" scope, a scope tab switcher, or a date picker.

#### Scenario: Default visit
- **WHEN** a visitor opens `/leaderboard`
- **THEN** the page renders the overall ranking from `v_leaderboard_overall`
- **AND** no scope tabs or date input are present in the DOM

#### Scenario: Stale today URL
- **WHEN** a visitor opens `/leaderboard?scope=today&date=2026-05-15`
- **THEN** the page renders the same overall ranking
- **AND** the URL parameters are ignored (no redirect, no 404)

#### Scenario: Stale overall URL
- **WHEN** a visitor opens `/leaderboard?scope=overall`
- **THEN** the page renders the overall ranking exactly as the bare `/leaderboard` URL would

### Requirement: Leaderboard does not depend on the timezone cookie

The leaderboard page SHALL NOT read or rely on the `tz` cookie, and SHALL NOT render any client component whose sole purpose is to populate that cookie.

#### Scenario: No tz dependency
- **WHEN** the leaderboard page renders for a visitor without a `tz` cookie
- **THEN** the same overall ranking is shown as for a visitor with a `tz` cookie set to any value

#### Scenario: TimezoneCookie removed
- **WHEN** the codebase is grepped for `TimezoneCookie`
- **THEN** there are no remaining references in `app/`, `components/`, or `lib/`

### Requirement: Copy across the app reflects a single overall leaderboard

User-facing copy outside the leaderboard page SHALL describe the leaderboard as a single overall ranking, with no "today" / "daily" framing.

#### Scenario: Homepage feature card
- **WHEN** a visitor reads the leaderboard-related feature card on `/`
- **THEN** the subtitle describes the leaderboard as a single ranking that refreshes on results (no "daily and overall" phrasing)

#### Scenario: How-it-works section
- **WHEN** a visitor reads `/how-it-works`
- **THEN** the leaderboard section is titled and described in global / overall terms only
- **AND** the page's metadata description does not mention "daily" or "today" in the leaderboard context

### Requirement: Leaderboards scope to the active competition

The overall leaderboard view (`v_leaderboard_overall`), the per-day function (`leaderboard_for_day()`), and the per-group board SHALL include only scores for matches belonging to the active competition, via a `matches` join filtered on `active_competition_id()`. Output row shapes and function signatures SHALL remain unchanged so existing callers are untouched.

#### Scenario: Overall leaderboard excludes other competitions

- **WHEN** the database contains matches for more than one competition
- **AND** a visitor opens `/leaderboard`
- **THEN** the ranking reflects only the active competition's scores

#### Scenario: Single-competition parity

- **WHEN** only the active competition has matches (as today with World Cup 2026)
- **THEN** the leaderboard output is identical to the pre-refactor output for every user and rank

#### Scenario: Group board scopes to its own competition

- **WHEN** a friend group's mini-board renders
- **THEN** it ranks members using only scores from the group's competition

### Requirement: Leaderboard standings table shows at most the top 10

The `/leaderboard` standings table SHALL render at most the top 10 ranked players (ranks 1 through 10) from `v_leaderboard_overall`. When fewer than 10 players exist, all of them SHALL be shown. The cap applies only to the rows passed to the standings table; the leader card, the total player count, and a signed-in user's own standing SHALL continue to reflect the full ranked field.

#### Scenario: More than 10 players
- **WHEN** the ranked field contains more than 10 players
- **AND** a visitor opens `/leaderboard`
- **THEN** the standings table renders exactly 10 rows, ranks 1 through 10 in order
- **AND** no 11th-or-lower row appears in the table

#### Scenario: Ten or fewer players
- **WHEN** the ranked field contains 10 or fewer players
- **AND** a visitor opens `/leaderboard`
- **THEN** the standings table renders every player

#### Scenario: Leader card and total count reflect the full field
- **WHEN** the ranked field contains more than 10 players
- **AND** a visitor opens `/leaderboard`
- **THEN** the leader card shows the rank-1 player
- **AND** the leader stat reports the full player count (not 10)

#### Scenario: Signed-in user ranked outside the top 10
- **WHEN** a signed-in user is ranked 11th or lower
- **AND** that user opens `/leaderboard`
- **THEN** the user does not appear in the top-10 standings table
- **AND** the "share your rank" section still shows that user's actual rank and points

### Requirement: Leaderboard standings table shows a Wins column

The `/leaderboard` standings table SHALL render a "Wins" column displaying each ranked
player's winner-only hit count (`winner_hits`) — the number of predictions that landed
the correct match winner without an exact score or goal-difference match. The column SHALL
appear alongside the existing Exact and W+GD columns and SHALL follow their responsive
behavior, hidden on the narrowest viewport and shown from the small breakpoint upward. The
column header SHALL be localized in every supported locale. The shared standings component
backing the friends' group mini-board SHALL render the same column.

#### Scenario: Wins column visible on the leaderboard

- **WHEN** a visitor opens `/leaderboard` on a viewport at or above the small breakpoint
- **THEN** the standings table includes a "Wins" column header
- **AND** each player row shows that player's `winner_hits` value in the Wins cell

#### Scenario: Wins reflects winner-only hits

- **WHEN** a player has predictions scored as winner-only (1 pt each)
- **THEN** that player's Wins cell shows the count of those winner-only hits
- **AND** exact and winner+goal-difference hits are not counted in the Wins cell

#### Scenario: Wins column hidden on mobile

- **WHEN** a visitor opens `/leaderboard` on a viewport below the small breakpoint
- **THEN** the Wins column is not rendered, matching the Exact and W+GD columns

#### Scenario: Localized header

- **WHEN** the leaderboard renders in any supported locale (en, es, fr, de)
- **THEN** the Wins column header is shown in that locale's translation

#### Scenario: Group mini-board shows Wins

- **WHEN** a friends' group mini-board renders
- **THEN** it includes the Wins column for each member, sourced from `winner_hits`

