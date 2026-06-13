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

