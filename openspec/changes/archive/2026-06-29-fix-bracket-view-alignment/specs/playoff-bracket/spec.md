## ADDED Requirements

### Requirement: Desktop bracket columns align headings and distribute matches

On large (desktop) viewports the columnar bracket layout SHALL render each round as a column whose round heading is pinned to the top, so that all round headings align on a single top baseline across columns. Within each column the match cards SHALL be vertically distributed in the space beneath the heading (so a later round's matches are centered between their feeder matches), independently of the heading position. The round heading SHALL NOT be displaced toward the column's vertical center when a column has fewer matches than other columns.

#### Scenario: Round headings align across columns

- **WHEN** the bracket is viewed on a desktop viewport with multiple rounds present
- **THEN** every round heading (Round of 32, Round of 16, Quarter-final, …) is positioned at the top of its column on the same baseline
- **AND** a later round with fewer matches does not push its heading toward the middle of the column

#### Scenario: Later-round matches center between feeders

- **WHEN** a round column has fewer match cards than the round to its left
- **THEN** its match cards are vertically distributed beneath the heading so each match sits centered against its two feeder matches
- **AND** the heading remains fixed at the top of the column

#### Scenario: Mobile layout unaffected

- **WHEN** the bracket is viewed on a small viewport
- **THEN** the single-round selector layout is unchanged by this presentation fix
