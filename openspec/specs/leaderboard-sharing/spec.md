# leaderboard-sharing

## Purpose

Social sharing of a player's overall leaderboard standing: share actions on the public `/leaderboard` page for the signed-in viewer's own row, a public share landing page that renders the standing from a URL, and the dynamically generated Open Graph rank card. Exists as a growth loop — a shared rank is both a brag and an invitation. Unlike `pick-sharing`, the rank is public data already in `v_leaderboard_overall`, so the landing page and OG card re-derive the standing live from the view rather than trusting numbers in the URL — keeping the brag truthful even when a link is stale or tampered.

## Requirements

### Requirement: Leaderboard offers share actions for the viewer's own standing

The leaderboard page (`/leaderboard`) SHALL render a share section when and only when the signed-in viewer appears in the overall ranking (`v_leaderboard_overall`). The section SHALL offer: an X/Twitter intent link prefilled with localized share text and the share URL, a Facebook sharer link carrying the share URL, a native-share button (`navigator.share`) when the browser supports it, and a copy-link action as fallback. Anonymous visitors and signed-in viewers without a ranked row SHALL NOT see the share section. Adding this section SHALL NOT introduce a scope tab, date picker, or `tz`-cookie dependency.

#### Scenario: Ranked viewer sees share actions
- **WHEN** a signed-in user ranked #3 with 47 points views the leaderboard page
- **THEN** the page shows share actions for X, Facebook, and copy-link
- **AND** the X intent URL contains the localized share text naming the rank and points, plus the share URL pointing at `/share/rank/<their userId>`

#### Scenario: Native share on supporting browsers
- **WHEN** the viewer's browser exposes `navigator.share`
- **THEN** a native share button is shown that invokes the OS share sheet with the share text and URL

#### Scenario: Signed-in but unranked viewer
- **WHEN** a signed-in user who has no row in the overall ranking views the leaderboard page
- **THEN** no share section is rendered

#### Scenario: Anonymous viewer
- **WHEN** a signed-out visitor views the leaderboard page
- **THEN** no share section is rendered

#### Scenario: Copy link
- **WHEN** the viewer activates the copy-link action
- **THEN** the share URL is written to the clipboard and a confirmation toast is shown

#### Scenario: No scope or timezone regression
- **WHEN** the leaderboard page renders with the share section present
- **THEN** the DOM contains no scope tabs or date input
- **AND** the page does not read or rely on the `tz` cookie

### Requirement: Public share landing page renders the live standing

The system SHALL serve `/{locale}/share/rank/{userId}` as a public page showing the user's display name, current rank, total points, exact-hit count, and the total number of ranked players, plus a call-to-action linking to the leaderboard. The page SHALL read the standing from `v_leaderboard_overall` at request time and SHALL NOT trust any rank or point values supplied in the URL. An unknown `userId` (no row in the view) SHALL return 404. A null display name SHALL render the same fallback label used on the leaderboard. The page SHALL be marked `noindex`.

#### Scenario: Valid share link
- **WHEN** a visitor opens `/en/share/rank/<userId>` for a user currently ranked #3 with 47 points
- **THEN** the page shows that user's display name, "#3", 47 points, their exact-hit count, and the total player count, plus a CTA linking to `/en/leaderboard`

#### Scenario: Rank is read live, not from the URL
- **WHEN** a visitor opens `/en/share/rank/<userId>?rank=1&points=999`
- **THEN** the rendered rank and points come from `v_leaderboard_overall`, not the query parameters

#### Scenario: Unknown user
- **WHEN** a visitor opens a share URL whose `userId` has no row in the ranking
- **THEN** the response is a 404

#### Scenario: Null display name degrades gracefully
- **WHEN** the shared user's `display_name` is null
- **THEN** the page renders the leaderboard's no-name fallback in place of the name (no error)

#### Scenario: Not indexed
- **WHEN** the share page is rendered
- **THEN** its metadata includes a noindex robots directive

### Requirement: Share URL unfurls into an Open Graph rank card

The share landing page SHALL declare Open Graph and Twitter Card (`summary_large_image`) metadata whose image is generated dynamically by `/api/og/rank` and shows the user's rank, display name, and points in the brand scoreboard style. The image route SHALL produce a 1200×630 image, SHALL read the standing live from `v_leaderboard_overall`, SHALL return 404 for an unknown `userId`, and SHALL send a short public cache (about 5 minutes) rather than an immutable cache because the underlying ranking changes.

#### Scenario: OG metadata present
- **WHEN** a scraper fetches `/en/share/rank/<userId>`
- **THEN** the HTML contains `og:image` and `twitter:card` (`summary_large_image`) metadata pointing at the rank-card image URL carrying the same `userId` and locale

#### Scenario: Card image renders the standing
- **WHEN** the OG image URL is requested for a user ranked #3 with 47 points
- **THEN** the response is a 1200×630 image showing "#3", the display name, and "47" points

#### Scenario: Image inputs validated
- **WHEN** the OG image URL is requested for a `userId` with no row in the ranking
- **THEN** the route responds with 404 (no broken half-rendered card)

#### Scenario: Cache is short-lived
- **WHEN** the OG image response is returned
- **THEN** its `Cache-Control` header sets a finite max-age (not `immutable`)

### Requirement: Share content is localized

Share text, share-page copy, and share-button labels SHALL be localized in en, es, and fr via a `shareRank` messages namespace. The share URL SHALL carry the sharer's locale so recipients land on a page in that locale.

#### Scenario: Spanish share
- **WHEN** a user on `/es/leaderboard` shares their standing to X
- **THEN** the intent text is Spanish and the shared URL starts with `/es/share/rank/`

#### Scenario: All locales covered
- **WHEN** the `shareRank` namespace is compared across `messages/en.json`, `messages/es.json`, and `messages/fr.json`
- **THEN** every key exists in all three files
