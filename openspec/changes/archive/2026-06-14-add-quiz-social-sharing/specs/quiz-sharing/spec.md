## ADDED Requirements

### Requirement: Quiz page offers share actions for the viewer's own standing

The quiz page (`/{locale}/quiz`) SHALL render a share section when and only when the signed-in viewer has answered at least one quiz question (`answeredCount > 0`). The section SHALL offer: an X/Twitter intent link prefilled with localized share text and the share URL, a Facebook sharer link carrying the share URL, a native-share button (`navigator.share`) when the browser supports it, and a copy-link action as fallback. The share URL SHALL be `/{locale}/share/quiz/{userId}` for the viewer's own id, built without any streak/points/rank parameters. Anonymous viewers and signed-in viewers with no answers SHALL NOT see the share section.

#### Scenario: Player with a standing sees share actions
- **WHEN** a signed-in user who has answered at least one quiz question views `/en/quiz`
- **THEN** the page shows share actions for X, Facebook, and copy-link
- **AND** the X intent URL contains the localized share text and the share URL `/en/share/quiz/<their-user-id>`

#### Scenario: Native share on supporting browsers
- **WHEN** the viewer's browser exposes `navigator.share`
- **THEN** a native share button is shown that invokes the OS share sheet with the share text and share URL

#### Scenario: No answers, no share section
- **WHEN** a signed-in user who has never answered a quiz question views `/en/quiz`
- **THEN** no share section is rendered

#### Scenario: Anonymous viewer
- **WHEN** a signed-out visitor views `/en/quiz`
- **THEN** no share section is rendered

#### Scenario: Copy link
- **WHEN** the viewer activates the copy-link action
- **THEN** the share URL is written to the clipboard and a confirmation toast is shown

### Requirement: Public share landing page renders the live quiz standing

The system SHALL serve `/{locale}/share/quiz/{userId}` as a public page showing the user's display name, current quiz streak, total quiz points, and current quiz rank (with the count of ranked players), plus a call-to-action linking to the quiz page. The page SHALL read the standing live from the public `v_quiz_standing` view at request time, and SHALL NOT trust any standing values supplied in the URL. A `userId` with no row in `v_quiz_standing` (i.e. the user has never answered) SHALL return 404. A null display name SHALL render the same fallback label used on the quiz page. The page SHALL be marked `noindex`.

#### Scenario: Valid share link renders live standing
- **WHEN** a visitor opens `/en/share/quiz/<id>` for a user who has answered quizzes
- **THEN** the page shows that user's display name, current streak, total points, and rank, plus a CTA linking to `/en/quiz`

#### Scenario: Standing is read live, not from the URL
- **WHEN** a visitor opens `/en/share/quiz/<id>` with any extra query parameters appended
- **THEN** the rendered streak, points, and rank come from `v_quiz_standing`, not from the query parameters

#### Scenario: Unknown user
- **WHEN** a visitor opens `/en/share/quiz/<id>` for an id with no row in `v_quiz_standing`
- **THEN** the response is a 404

#### Scenario: Not indexed
- **WHEN** the share page is rendered
- **THEN** its metadata includes a noindex robots directive

### Requirement: Share URL unfurls into an Open Graph quiz card

The share landing page SHALL declare Open Graph and Twitter Card (`summary_large_image`) metadata whose image is generated dynamically by `/api/og/quiz` and shows the user's streak, total points, and rank with their display name in the brand scoreboard style. The image route SHALL produce a 1200×630 image, SHALL read the standing live from `v_quiz_standing`, SHALL return 404 for a `userId` with no row in the view, and SHALL send a short public cache (about 5 minutes) rather than an immutable cache because the standing changes over time.

#### Scenario: OG metadata present
- **WHEN** a scraper fetches `/en/share/quiz/<id>`
- **THEN** the HTML contains `og:image` and `twitter:card` (`summary_large_image`) metadata pointing at the quiz-card image URL for the same user and locale

#### Scenario: Card image renders the standing
- **WHEN** the OG image URL is requested for a user with a streak of 5 and 120 points
- **THEN** the response is a 1200×630 image containing the streak value 5 and the points value 120

#### Scenario: Image inputs validated
- **WHEN** the OG image URL is requested for a `userId` with no quiz answers
- **THEN** the route responds with 404 (no broken half-rendered card)

#### Scenario: Cache is short-lived
- **WHEN** the OG image URL is requested
- **THEN** its `Cache-Control` header sets a finite max-age (not `immutable`) and includes `stale-while-revalidate`

### Requirement: Quiz card image supports conditional requests

The image response SHALL carry a strong `ETag` derived from the exact values the card renders (streak, total points, answered count, rank, ranked-player count, display name, locale, and a card-design version). When a request's `If-None-Match` matches that `ETag`, the route SHALL respond `304 Not Modified` without rasterizing a new image. None of this caching SHALL cause the card to display a value not currently derivable from `quiz_answers` and `v_quiz_leaderboard`.

#### Scenario: Conditional request short-circuits
- **WHEN** the OG image URL is requested with an `If-None-Match` header equal to the `ETag` of the user's current standing
- **THEN** the route responds `304 Not Modified` without generating a new image

#### Scenario: ETag changes when the standing changes
- **WHEN** the user's streak or points change and the OG image URL is requested again
- **THEN** the response carries a different `ETag` than before, so a previously cached card is not served as unchanged

### Requirement: Quiz share content is localized

Share text, share-page copy, and share-button labels SHALL be localized in en, es, and fr via a `shareQuiz` messages namespace. The share URL SHALL carry the sharer's locale so recipients land on a page in that locale.

#### Scenario: Spanish share
- **WHEN** a user on `/es/quiz` shares their standing to X
- **THEN** the intent text is Spanish and the shared URL starts with `/es/share/quiz/`

#### Scenario: All locales covered
- **WHEN** the `shareQuiz` namespace is loaded for en, es, and fr
- **THEN** every key used by the quiz share section, landing page, and OG alt text resolves in all three locales
