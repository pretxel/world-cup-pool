# pick-sharing (delta)

## ADDED Requirements

### Requirement: Match detail offers share actions for the viewer's saved pick

The match detail page (`/matches/[matchId]`) SHALL render a share section when and only when the signed-in viewer has a saved prediction for that match. The section SHALL offer: an X/Twitter intent link prefilled with localized share text and the share URL, a Facebook sharer link carrying the share URL, a native-share button (`navigator.share`) when the browser supports it, and a copy-link action as fallback. Anonymous viewers and viewers without a prediction SHALL NOT see the share section.

#### Scenario: Viewer with a pick sees share actions
- **WHEN** a signed-in user with a saved prediction of 2–1 views the match detail page
- **THEN** the page shows share actions for X, Facebook, and copy-link
- **AND** the X intent URL contains the localized share text naming both teams and the 2–1 score, plus the share URL

#### Scenario: Native share on supporting browsers
- **WHEN** the viewer's browser exposes `navigator.share`
- **THEN** a native share button is shown that invokes the OS share sheet with the share text and URL

#### Scenario: No pick, no share section
- **WHEN** a signed-in user without a prediction for the match views the page
- **THEN** no share section is rendered

#### Scenario: Anonymous viewer
- **WHEN** a signed-out visitor views the match detail page
- **THEN** no share section is rendered

#### Scenario: Copy link
- **WHEN** the viewer activates the copy-link action
- **THEN** the share URL is written to the clipboard and a confirmation toast is shown

### Requirement: Public share landing page renders a pick from URL parameters

The system SHALL serve `/{locale}/share/pick/{matchId}?h=<int>&a=<int>` as a public page showing both teams (names and flags), the shared predicted score, the match stage and kickoff, and a call-to-action linking to the match detail page. The page SHALL validate inputs: unknown `matchId` returns 404; `h`/`a` are parsed as integers and clamped to 0–20; missing or invalid scores render the page without score numerals. The page SHALL be marked `noindex` and SHALL NOT read any user's stored predictions.

#### Scenario: Valid share link
- **WHEN** a visitor opens `/en/share/pick/<id>?h=2&a=1` for an existing match
- **THEN** the page shows both team names, flags, and "2–1", plus a CTA linking to `/en/matches/<id>`

#### Scenario: Unknown match
- **WHEN** a visitor opens a share URL whose `matchId` does not exist
- **THEN** the response is a 404

#### Scenario: Tampered scores are clamped
- **WHEN** a visitor opens a share URL with `h=999&a=-5`
- **THEN** the rendered scores are clamped into the 0–20 range

#### Scenario: Missing scores degrade gracefully
- **WHEN** a visitor opens a share URL without `h`/`a` parameters
- **THEN** the page renders teams and CTA without score numerals (no error)

#### Scenario: Not indexed
- **WHEN** the share page is rendered
- **THEN** its metadata includes a noindex robots directive

### Requirement: Share URL unfurls into an Open Graph card showing the pick

The share landing page SHALL declare Open Graph and Twitter Card (`summary_large_image`) metadata whose image is generated dynamically and shows both team identities and the shared score. The image route SHALL produce a 1200×630 image, SHALL fall back to a neutral team mark when a flag asset is unavailable, and SHALL send long-lived public cache headers since identical parameters always produce an identical image.

#### Scenario: OG metadata present
- **WHEN** a scraper fetches `/en/share/pick/<id>?h=2&a=1`
- **THEN** the HTML contains `og:image` and `twitter:card` (`summary_large_image`) metadata pointing at the pick-card image URL carrying the same match and score parameters

#### Scenario: Card image renders the pick
- **WHEN** the OG image URL is requested with valid parameters
- **THEN** the response is a 1200×630 image containing both team names and the score "2–1"

#### Scenario: Image inputs validated
- **WHEN** the OG image URL is requested with an unknown match id
- **THEN** the route responds with 404 (no broken half-rendered card)

### Requirement: Share content is localized

Share text, share-page copy, and share-button labels SHALL be localized in en, es, and fr via a `sharePick` messages namespace. The share URL SHALL carry the sharer's locale so recipients land on a page in that locale.

#### Scenario: Spanish share
- **WHEN** a user on `/es/matches/<id>` shares their 2–1 pick to X
- **THEN** the intent text is Spanish and the shared URL starts with `/es/share/pick/`

#### Scenario: All locales covered
- **WHEN** the `sharePick` namespace is compared across `messages/en.json`, `messages/es.json`, and `messages/fr.json`
- **THEN** every key exists in all three files
