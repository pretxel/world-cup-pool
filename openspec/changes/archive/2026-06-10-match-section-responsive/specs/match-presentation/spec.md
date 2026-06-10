# match-presentation (delta)

## ADDED Requirements

### Requirement: Matches list renders responsively on all viewports

The public `/matches` page SHALL render without horizontal page overflow and remain legible and operable at every viewport width from 320px up to desktop. Below the `sm` breakpoint (640px) each match row SHALL present the two teams as separate stacked lines (flag plus full team name per line); at `sm` and above the existing single-line `home vs away` layout SHALL be preserved. The kickoff time SHALL remain visible at all widths.

#### Scenario: No horizontal overflow at 320px
- **WHEN** a user views `/matches` in a 320px-wide viewport
- **THEN** the document does not scroll horizontally (`scrollWidth` does not exceed the viewport width)

#### Scenario: Teams stack on small screens
- **WHEN** a user views `/matches` in a viewport narrower than 640px
- **THEN** each match row shows the home team and away team on separate lines, each with its flag and team name
- **AND** the kickoff time is still visible in the row

#### Scenario: Desktop layout unchanged
- **WHEN** a user views `/matches` in a viewport 640px wide or wider
- **THEN** each match row shows both teams on a single line in the form "home vs away" with flags, as before

#### Scenario: Long team names stay legible on mobile
- **WHEN** a match between two long-named teams (e.g. "United States" vs "Saudi Arabia") is rendered in a 320px-wide viewport
- **THEN** both team names are fully readable on their own lines without overlapping the score/status column

### Requirement: Matches list filters remain usable at small viewports

The status stat-card filter, needs-pick toggle, and team chip filter on `/matches` SHALL remain fully visible and operable at viewport widths down to 320px in every supported locale. Stat-card labels SHALL NOT clip or overflow their cards, and team chips SHALL wrap onto additional lines rather than overflowing horizontally.

#### Scenario: Stat cards fit at 320px
- **WHEN** a user views `/matches` at 320px width in any supported locale (en, es, fr)
- **THEN** all three status cards are visible with their label and count readable and not clipped

#### Scenario: Team chips wrap
- **WHEN** the team filter renders more chips than fit on one line
- **THEN** chips wrap onto subsequent lines and the page does not scroll horizontally

### Requirement: Sticky day headers keep correct offset on all devices

The sticky matchday headers on `/matches` SHALL remain pinned directly below the site navigation, without gap or overlap, at both mobile and desktop viewport widths.

#### Scenario: Sticky header on mobile
- **WHEN** a user scrolls the `/matches` list in a viewport narrower than 640px
- **THEN** the active matchday header sticks immediately below the site navigation with no visual overlap of row content behind the nav

#### Scenario: Sticky header on desktop
- **WHEN** a user scrolls the `/matches` list in a viewport 1024px wide or wider
- **THEN** the active matchday header sticks immediately below the site navigation
