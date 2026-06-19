# friend-challenge-head-to-head

## Purpose

A public, shareable one-to-one comparison of two players (rank, points, exact hits, recent form) rendered as both an HTML landing page and an Open Graph card, built on the existing leaderboard view, scores table, and share/OG infrastructure. It turns the most natural social hook — "I'm beating you" — into a shareable artifact, giving mid-table players a reachable rivalry and giving shares a return loop. The feature is read-only: it reads `v_leaderboard_overall` and `scores` live, never writes to scoring, and the landing page stays `noindex` like the other `/share/*` pages.

## Requirements

### Requirement: Head-to-head comparison landing page

The system SHALL serve a public, locale-aware page at `/[locale]/h2h/[a]/[b]` that compares exactly two players identified by their `user_id`, reading each player's `rank`, `total_points`, and `exact_hits` live from `v_leaderboard_overall` and a recent-form strip derived from the `scores` table. Displayed numbers MUST be re-derived server-side on each request and MUST NOT be taken from the URL. The page MUST require no authentication.

#### Scenario: Both players exist
- **WHEN** an anonymous visitor requests `/[locale]/h2h/[a]/[b]` and both `a` and `b` appear in `v_leaderboard_overall`
- **THEN** the page renders a side-by-side comparison showing each player's display name, rank, total points, exact hits, and recent-form strip, with values read live from `v_leaderboard_overall` and `scores`

#### Scenario: A player is missing
- **WHEN** a visitor requests `/[locale]/h2h/[a]/[b]` and either `a` or `b` is absent from `v_leaderboard_overall`
- **THEN** the page responds with a not-found result rather than a partially rendered comparison

### Requirement: Canonical head-to-head URL ordering

The system SHALL treat a head-to-head between two players as order-independent by canonicalizing the two `user_id`s into a single deterministic order (lexicographic by `user_id`). A request whose path order differs from the canonical order MUST redirect to the canonical URL, so each rivalry maps to exactly one URL and one cacheable OG card.

#### Scenario: Reversed order redirects to canonical
- **WHEN** a visitor requests `/[locale]/h2h/[b]/[a]` where the canonical order is `a` then `b`
- **THEN** the request redirects to `/[locale]/h2h/[a]/[b]`

#### Scenario: Builder returns the canonical path
- **WHEN** `buildH2HPath` is called with the two ids in either order
- **THEN** it returns the same canonical path string regardless of argument order

### Requirement: Head-to-head Open Graph card

The system SHALL serve an Open Graph image at `/api/og/h2h` that rasterizes a two-column "VS" scoreboard for the two players (display name, rank, points, exact hits, recent-form pips per side). The route MUST run on the Node runtime, read standings cookie-lessly from `v_leaderboard_overall` and `scores`, validate both users before rendering, compute a strong ETag covering exactly the values drawn (including a versioned card token and locale), answer `304 Not Modified` when `If-None-Match` matches, and set the shared OG cache-control header. An unknown user MUST yield a `404`, never a partial card.

#### Scenario: Card renders for two valid players
- **WHEN** `/api/og/h2h` is requested with two valid `user_id`s and no matching `If-None-Match`
- **THEN** it returns a 1200x630 PNG showing both players' name, rank, points, exact hits, and form pips, with `ETag` and the OG cache-control header set

#### Scenario: Unchanged card answers 304
- **WHEN** `/api/og/h2h` is re-requested with an `If-None-Match` that equals the current ETag for those two standings
- **THEN** it responds `304 Not Modified` without rasterizing a new image

#### Scenario: Unknown user yields 404
- **WHEN** `/api/og/h2h` is requested and either `user_id` is missing from `v_leaderboard_overall`
- **THEN** it responds `404` without rendering an image

### Requirement: Shareable head-to-head metadata

The landing page SHALL emit Open Graph and Twitter card metadata whose image points at `/api/og/h2h` for the two players, and the page MUST be excluded from search indexing (`robots: noindex`), mirroring the existing `/share/*` landing pages.

#### Scenario: Unfurl metadata present
- **WHEN** a social scraper fetches `/[locale]/h2h/[a]/[b]` for two valid players
- **THEN** the response head includes `og:image` and `twitter:image` resolving to `/api/og/h2h` for those players, a `summary_large_image` twitter card, and a `noindex` robots directive

### Requirement: Recent-form derivation

The system SHALL derive each player's recent form from the `scores` table by selecting that player's most recent scored matches ordered by `computed_at` descending (default the last 5), classifying each by `hit_type` as a hit (`exact`, `winner_gd`, or `winner`) or a miss (`miss`). The same derivation MUST be used by both the landing page and the OG card so the strips match.

#### Scenario: Form reflects latest scored results
- **WHEN** a player's recent form is computed for the head-to-head
- **THEN** it lists that player's most recent scored matches (up to the limit), newest first, each marked hit or miss according to its `hit_type`

#### Scenario: Player with no scored matches
- **WHEN** a player appears in `v_leaderboard_overall` but has no rows in `scores`
- **THEN** the recent-form strip for that player is empty and the comparison still renders the player's rank, points, and exact hits

### Requirement: Leaderboard challenge entry point

The leaderboard SHALL provide a one-click affordance for a signed-in viewer to create a head-to-head link between themselves and another listed player, building the canonical URL via the share helper and surfacing share actions via the existing `ShareButtons` component with a head-to-head context. The leaderboard's existing realtime and segment behavior MUST remain unchanged.

#### Scenario: Signed-in viewer challenges another player
- **WHEN** a signed-in viewer who appears on the leaderboard chooses to challenge another listed player
- **THEN** a head-to-head share link of the form `${siteUrl}${buildH2HPath(locale, me, them)}` is produced and offered through the share buttons

### Requirement: Head-to-head analytics

The system SHALL emit analytics for head-to-head engagement consistent with existing instrumentation: a view event when the landing page loads and a share/create event when a challenge link is shared (the share emitting `share_click` with a head-to-head context via `ShareButtons`). Analytics MUST be fire-and-forget and MUST NOT block or break rendering or sharing if analytics is unavailable.

#### Scenario: View event on landing
- **WHEN** the head-to-head landing page loads in a browser with analytics available
- **THEN** a head-to-head view event is emitted

#### Scenario: Share event carries head-to-head context
- **WHEN** a viewer shares a head-to-head link via the share buttons
- **THEN** a `share_click` event is emitted carrying the platform and a head-to-head context value
