## ADDED Requirements

### Requirement: Not-found pages display a football image

Both the root not-found page (`app/not-found.tsx`) and the localized not-found page (`app/[locale]/not-found.tsx`) SHALL render a football image alongside the existing `404` headline, body, and recovery links. The image SHALL be served from a self-hosted asset under `public/` and SHALL NOT depend on any external network request to render.

#### Scenario: Football image on the root not-found page

- **WHEN** a visitor lands on an unmatched route that resolves to the root not-found page
- **THEN** the page renders a football image above the `404` headline
- **AND** the existing `Back home` and `Browse matches` links remain present

#### Scenario: Football image on the localized not-found page

- **WHEN** a visitor lands on an unmatched route under a locale that resolves to the localized not-found page
- **THEN** the page renders the same football image above the localized `404` headline
- **AND** the existing localized recovery links remain present

#### Scenario: Image renders without a network call

- **WHEN** either not-found page renders
- **THEN** the football image loads from a self-hosted asset under `public/`
- **AND** no external/CDN request is required for the image to appear

### Requirement: Football image is decorative and accessible

The football image SHALL be treated as decorative and excluded from the accessibility tree, since the visible `404` text already conveys the not-found meaning. The image SHALL NOT introduce a layout shift when the page renders.

#### Scenario: Screen reader skips the decorative image

- **WHEN** a screen-reader user reaches either not-found page
- **THEN** the football image is hidden from assistive technology (empty alt or `aria-hidden`)
- **AND** the `404` headline and body text are still announced

#### Scenario: No new translation strings required

- **WHEN** the localized not-found page renders in `en`, `es`, or `fr`
- **THEN** the existing `notFound` message keys are used unchanged
- **AND** no new i18n key is required for the decorative image

#### Scenario: Image does not cause layout shift

- **WHEN** either not-found page loads
- **THEN** the football image occupies reserved dimensions
- **AND** the surrounding text and links do not reflow as the image appears
