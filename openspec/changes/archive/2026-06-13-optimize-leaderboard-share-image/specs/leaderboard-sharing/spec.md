## MODIFIED Requirements

### Requirement: Share URL unfurls into an Open Graph rank card

The share landing page SHALL declare Open Graph and Twitter Card (`summary_large_image`) metadata whose image is generated dynamically by `/api/og/rank` and shows the user's rank, display name, and points in the brand scoreboard style. The image route SHALL produce a 1200×630 image, SHALL read the standing live from `v_leaderboard_overall`, SHALL return 404 for an unknown `userId`, and SHALL send a short public cache (about 5 minutes) rather than an immutable cache because the underlying ranking changes.

The card SHALL render its text in the product's brand typefaces — the rank number and display name in the heading face (Bricolage Grotesque) and the labels in the monospace face (JetBrains Mono) — loaded as embedded fonts rather than relying on the image library's generic fallback. A configured fallback font SHALL still cover glyphs (e.g. non-Latin display names) outside the embedded subset so no name renders as empty boxes.

The image response SHALL carry a strong `ETag` derived from the exact values the card renders (rank, display name, total points, exact-hit count, player count, locale, and a card-design version). When a request's `If-None-Match` matches that `ETag`, the route SHALL respond `304 Not Modified` without rasterizing a new image. The `Cache-Control` header SHALL additionally permit background revalidation via `stale-while-revalidate`. None of these caching changes SHALL cause the card to display a value not currently in `v_leaderboard_overall`.

#### Scenario: OG metadata present
- **WHEN** a scraper fetches `/en/share/rank/<userId>`
- **THEN** the HTML contains `og:image` and `twitter:card` (`summary_large_image`) metadata pointing at the rank-card image URL carrying the same `userId` and locale

#### Scenario: Card image renders the standing
- **WHEN** the OG image URL is requested for a user ranked #3 with 47 points
- **THEN** the response is a 1200×630 image showing "#3", the display name, and "47" points

#### Scenario: Card renders in brand typography
- **WHEN** the OG image is generated
- **THEN** the rank number and display name are drawn in the brand heading face and the labels in the brand monospace face (embedded fonts), not the image library's default fallback

#### Scenario: Non-Latin display name still renders
- **WHEN** the shared user's display name contains glyphs outside the embedded font subset
- **THEN** the card renders those glyphs via the configured fallback font rather than empty boxes (no broken card)

#### Scenario: Image inputs validated
- **WHEN** the OG image URL is requested for a `userId` with no row in the ranking
- **THEN** the route responds with 404 (no broken half-rendered card)

#### Scenario: Cache is short-lived
- **WHEN** the OG image response is returned
- **THEN** its `Cache-Control` header sets a finite max-age (not `immutable`) and includes `stale-while-revalidate`

#### Scenario: Unchanged standing revalidates to 304
- **WHEN** the OG image URL is requested with an `If-None-Match` header equal to the `ETag` of the user's current standing
- **THEN** the route responds `304 Not Modified` and does not rasterize a new image

#### Scenario: ETag changes when the standing changes
- **WHEN** the same user's rank or points change between two requests for the OG image
- **THEN** the second response carries a different `ETag` than the first, so a previously cached card is not served as unchanged
