## MODIFIED Requirements

### Requirement: Landing gallery of recent recap images

The landing page SHALL display a gallery of the most recently generated match recap
comic images, newest first, limited to the **5 most recent**. Each item SHALL link to its
match page and SHALL carry alt text naming the two teams. The gallery SHALL source only
active, completed renders (public visibility via the existing RLS); draft or
incomplete renders SHALL NOT appear.

#### Scenario: Recent comics are shown

- **WHEN** the landing page loads and at least one match has an active completed recap
  render
- **THEN** a gallery of those comic images is shown, newest first, capped at 5,
  each linking to its match with team-named alt text

#### Scenario: Ordering and cap

- **WHEN** more than 5 completed renders exist
- **THEN** only the 5 most recent (by render time) are shown
