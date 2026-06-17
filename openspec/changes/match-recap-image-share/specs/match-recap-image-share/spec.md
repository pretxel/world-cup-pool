## ADDED Requirements

### Requirement: Public display of the recap comic image

The public match view SHALL display the rendered comic image of a match's **active**
recap when that recap has a completed render. The image SHALL be served from its public
Storage URL and SHALL carry descriptive alt text naming the two teams. When no completed
render exists for the active recap, the page SHALL show no image (and the text recap, if
any, is unaffected). Only the active version's image SHALL ever be shown — draft renders
SHALL NOT appear (enforced by the existing active-only RLS).

#### Scenario: Active recap has a completed render

- **WHEN** a visitor opens a final match whose active recap has a `complete` render
- **THEN** the comic image is shown in the recap section with team-named alt text

#### Scenario: No completed render

- **WHEN** the active recap has no render, or its render is `pending`/`failed`
- **THEN** no image is shown and the rest of the page renders normally

### Requirement: Social share of the match recap

The public match view SHALL provide a social share control for the recap, reusing the
site's share component (X, Facebook, native share, copy link). The shared target SHALL be
the canonical match page URL, and the share SHALL be offered when the recap comic image
is present. Share text SHALL name the match.

#### Scenario: Sharing the recap

- **WHEN** the recap comic image is shown and a visitor uses the share control
- **THEN** the match page URL is shared (via X / Facebook / native / copy) with match-
  naming share text

### Requirement: Comic preview in link metadata

When a match's active recap has a completed render, the page's `generateMetadata` SHALL
set the OpenGraph and Twitter image to the comic's public URL (Twitter card
`summary_large_image`), so a shared link unfurls with the comic as its preview image.
When no completed render exists, the page SHALL fall back to its current metadata with no
image.

#### Scenario: Shared link unfurls with the comic

- **WHEN** the match page is shared and its active recap has a completed render
- **THEN** the OpenGraph/Twitter preview image is the comic's public URL

#### Scenario: Metadata without a render

- **WHEN** the active recap has no completed render
- **THEN** the page metadata is unchanged (no image), exactly as today
