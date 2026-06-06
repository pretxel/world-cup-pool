# landing-page Specification

## Purpose
TBD - created by archiving change landing-feature-sections. Update Purpose after archive.
## Requirements
### Requirement: Landing page explains the Groups, News, and Quiz features
The landing page (`/`) SHALL render a feature section that describes the Groups, News, and Quiz features, with one card per feature. Each card SHALL show a title, a one-line description, and a link to that feature's route.

#### Scenario: All three feature cards present
- **WHEN** a visitor opens the landing page
- **THEN** the page renders a feature section containing exactly one card each for Groups, News, and Quiz
- **AND** each card shows a title and a short description of that feature

#### Scenario: Each card links to its route
- **WHEN** a visitor opens the landing page
- **THEN** the Groups card links to `/groups`, the News card links to `/news`, and the Quiz card links to `/quiz`
- **AND** each link is locale-prefixed for the current locale (e.g. `/es/news` on the Spanish page)

#### Scenario: Groups link funnels signed-out visitors to sign-in
- **WHEN** a signed-out visitor follows the Groups card link
- **THEN** they are taken to the sign-in flow (the Groups route is behind authentication) rather than seeing an error page

### Requirement: Feature section copy is localized
All copy in the landing feature section SHALL be sourced from translation messages and provided for every supported locale, with no hard-coded display strings.

#### Scenario: Localized rendering
- **WHEN** a visitor opens the landing page in `en`, `es`, or `fr`
- **THEN** the feature section's eyebrow, headline, and each card's title, description, and link label render in that locale

#### Scenario: Key parity across locales
- **WHEN** the message bundles are checked
- **THEN** the new feature-section keys exist in `en`, `es`, and `fr` with an identical key set

### Requirement: Feature section is additive to the existing landing page
Adding the feature section SHALL NOT remove or alter the existing Hero, scoring, cadence, or tournament-countdown sections, and SHALL NOT introduce new routes or server data fetching.

#### Scenario: Existing sections preserved
- **WHEN** a visitor opens the landing page after this change
- **THEN** the Hero, scoring tiers, cadence steps, and countdown still render as before
- **AND** the feature section appears in addition to them

#### Scenario: No backend dependency
- **WHEN** the landing page renders the feature section
- **THEN** it does so from static copy and links only, without querying the database or any external service

