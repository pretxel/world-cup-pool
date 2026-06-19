## MODIFIED Requirements

### Requirement: Landing gallery of recent recap images

The landing page SHALL display a gallery of generated match recap comic images for the
matches whose kickoff is most recent, ordered by **match kickoff date descending** and
limited to the **5 most recent matches**. Each item SHALL link to its match page and SHALL
carry alt text naming the two teams. The gallery SHALL source only active, completed
renders (public visibility via the existing RLS); draft or incomplete renders SHALL NOT
appear.

#### Scenario: Recent matches' comics are shown, ordered by match date

- **WHEN** the landing page loads and at least one match has an active completed recap
  render
- **THEN** a gallery of those comic images is shown, ordered by match kickoff date with the
  most recent match first, capped at 5, each linking to its match with team-named alt text

#### Scenario: Selection and cap by match date

- **WHEN** more than 5 matches have an active completed render
- **THEN** only the comics for the 5 matches with the most recent kickoff dates are shown,
  in match-date-descending order

#### Scenario: Tie-break on equal kickoff

- **WHEN** two shown matches share the same kickoff date
- **THEN** their order is deterministic (most recently rendered first)
