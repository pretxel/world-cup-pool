# landing-recent-recap-images Specification

## Purpose
TBD - created by archiving change landing-recent-recap-images. Update Purpose after archive.
## Requirements
### Requirement: Landing gallery of recent recap images

The landing page SHALL display a gallery of the most recently generated match recap
comic images, newest first, limited to a bounded count. Each item SHALL link to its
match page and SHALL carry alt text naming the two teams. The gallery SHALL source only
active, completed renders (public visibility via the existing RLS); draft or
incomplete renders SHALL NOT appear.

#### Scenario: Recent comics are shown

- **WHEN** the landing page loads and at least one match has an active completed recap
  render
- **THEN** a gallery of those comic images is shown, newest first, capped at the bounded
  count, each linking to its match with team-named alt text

#### Scenario: Ordering and cap

- **WHEN** more completed renders exist than the cap
- **THEN** only the most recent (by render time) up to the cap are shown

### Requirement: Hidden when empty

When no active completed recap renders exist, the landing page SHALL render no gallery
section (no heading, no empty placeholder) and the rest of the page SHALL be unaffected.

#### Scenario: No comics yet

- **WHEN** the landing page loads and no match has an active completed render
- **THEN** the gallery section is absent and the page renders normally

