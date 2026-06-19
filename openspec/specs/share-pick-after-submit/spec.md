# share-pick-after-submit

## Purpose

Surface an inline share CTA in the prediction form immediately after a pick is successfully submitted, converting the highest-intent instant (the moment a scoreline is locked in) into organic reach. Reuses the existing pick-share infrastructure (`ShareButtons`, `buildPickSharePath`, the `/share/pick/[matchId]` landing, the `/api/og/pick` card, and the `sharePick.*` messages) without modifying it — no new share landing, OG route, schema, or strings.

## Requirements

### Requirement: Inline share CTA after a successful pick submit

The prediction form (`PredictionForm`) SHALL reveal an inline "Share your pick" CTA with the existing `ShareButtons` (X, Facebook, native share, copy link) immediately after `submitPrediction` returns a successful result. The CTA SHALL appear for both a newly created pick and an updated pick. The CTA SHALL NOT be rendered before any successful submit in the current session, and SHALL reuse the existing `sharePick.*` messages (`heading`, `shareText`, `shareOnX`, `shareOnFacebook`, `shareNative`, `copyLink`, `copied`) for all visible text.

#### Scenario: First pick submitted reveals share CTA

- **WHEN** a signed-in, non-admin user submits a new prediction for an unlocked match and the action succeeds
- **THEN** the success toast (`predictionForm.pickLocked`) shows as before
- **AND** an inline "Share your pick" heading and the X / Facebook / copy share affordances appear below the form

#### Scenario: Updating an existing pick re-reveals the share CTA

- **WHEN** a user who already submitted edits the scores and re-submits successfully
- **THEN** the share CTA is shown reflecting the newly saved scoreline

#### Scenario: No CTA before submitting

- **WHEN** the prediction form first renders for an unlocked match
- **THEN** no share CTA or share buttons are shown until a successful submit occurs

### Requirement: Share target reflects the just-submitted scoreline

The share CTA SHALL target the existing pick-share landing for this match with the exact scores that were just saved, built via `buildPickSharePath(locale, matchId, home, away)` prefixed with the site base URL to form an absolute URL, and SHALL pass `sharePick.shareText` populated with the match teams and those scores to `ShareButtons`. The form MUST NOT advertise scores that differ from the last successfully saved prediction.

#### Scenario: Share URL and text match the saved pick

- **WHEN** a user submits a `2–1` prediction for a match and the share CTA appears
- **THEN** the share URL is the absolute `/{locale}/share/pick/{matchId}?h=2&a=1` link
- **AND** the share text is `sharePick.shareText` filled with the two team names and the `2–1` scoreline

#### Scenario: Editing after sharing hides the stale CTA

- **WHEN** the share CTA is visible and the user changes a score stepper without re-submitting
- **THEN** the share CTA is hidden so it never advertises an unsaved scoreline
- **AND** the CTA reappears, reflecting the new scores, only after a subsequent successful submit

### Requirement: Reuse existing share infrastructure unchanged

The change SHALL consume the existing `ShareButtons` component, `buildPickSharePath`, the `/share/pick/[matchId]` landing route, and the `/api/og/pick` card without modifying them, and SHALL NOT introduce a new share landing page, OG image route, schema change, or database query. The site base URL needed for an absolute share link SHALL be provided to the client form from the server (e.g. `env.siteUrl`) rather than read from `window.location`.

#### Scenario: No new infrastructure introduced

- **WHEN** the share CTA is added to the prediction form
- **THEN** `components/share-buttons.tsx`, `lib/share.ts`, `app/[locale]/(public)/share/pick/[matchId]`, and `app/api/og/pick` are reused as-is with no signature changes
- **AND** no new database table, query, or RLS policy is added

#### Scenario: Absolute URL sourced from the server

- **WHEN** the prediction form composes the share URL on the client
- **THEN** it uses a site base URL passed in as a prop from the Server Component (e.g. `env.siteUrl`) combined with `buildPickSharePath`, not `window.location`
