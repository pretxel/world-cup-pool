# match-presentation (delta)

## ADDED Requirements

### Requirement: Match detail scoreboard renders responsively on all viewports

The match detail page (`/matches/[matchId]`) SHALL render its scoreboard hero legibly at every viewport width from 320px up to desktop, without horizontal page overflow. Below the `sm` breakpoint (640px) the scoreboard SHALL stack the home team, the score (or "vs" placeholder), and the away team as full-width rows so both team names are fully readable; at `sm` and above the existing three-column (home / score / away) layout SHALL be preserved.

#### Scenario: Team names readable at 320px
- **WHEN** a user views `/matches/<id>` in a 320px-wide viewport
- **THEN** both team names render fully readable (e.g. "Mexico" and "South Africa" are not truncated to fragments)
- **AND** each team row shows its flag

#### Scenario: Scoreboard stacks on small screens
- **WHEN** a user views `/matches/<id>` in a viewport narrower than 640px
- **THEN** the home team, score/"vs" block, and away team appear as stacked rows rather than three side-by-side columns

#### Scenario: Desktop scoreboard unchanged
- **WHEN** a user views `/matches/<id>` in a viewport 640px wide or wider
- **THEN** the scoreboard renders home team, score, and away team side by side in three columns, as before

#### Scenario: Final score variant stacks too
- **WHEN** a match with `status = 'final'` and recorded scores is viewed in a viewport narrower than 640px
- **THEN** the numeric score renders in the stacked center block between the two full-width team rows

#### Scenario: No horizontal overflow on the detail page at 320px
- **WHEN** a user views `/matches/<id>` in a 320px-wide viewport in any supported locale (en, es, fr)
- **THEN** the document does not scroll horizontally (`scrollWidth` does not exceed the viewport width)
