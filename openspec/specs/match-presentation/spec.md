# match-presentation

## Purpose

Visual rendering rules for matches across the public list, match detail, and authenticated picks views. Covers country flags, stage iconography, optional venue imagery, entrance animations, and the tournament-kickoff countdown on the landing page. The leaderboard is explicitly outside this capability.
## Requirements
### Requirement: TeamFlag resolves country teams to flag images

The system SHALL provide a `TeamFlag` component that renders an SVG flag for any of the 48 WC2026 participating national teams, sized `sm`, `md`, or `lg`. For team strings that are not in the participating-teams list (knockout placeholders, unknown teams), the component SHALL render a neutral placeholder chip instead of breaking the layout.

#### Scenario: Known country
- **WHEN** `<TeamFlag team="Argentina" size="md" />` is rendered
- **THEN** the DOM contains an image element pointing at `/flags/ar.svg` with non-empty `alt` text containing "Argentina"

#### Scenario: UK home nation
- **WHEN** `<TeamFlag team="England" />` is rendered
- **THEN** the image points at `/flags/gb-eng.svg`

#### Scenario: Knockout placeholder
- **WHEN** `<TeamFlag team="2nd Group A" />` is rendered
- **THEN** no `/flags/*.svg` image is rendered
- **AND** a placeholder element with the same outer dimensions as a real flag is rendered (no layout shift)

#### Scenario: Unknown team
- **WHEN** `<TeamFlag team="Atlantis" />` is rendered
- **THEN** the placeholder element is rendered (not a broken image)

### Requirement: Team-to-flag mapping covers every seeded country team

The `lib/team-flag.ts` mapping SHALL contain an entry for every country team currently present in `supabase/seed/matches.sql`. A test SHALL enforce this so that adding a new team to the seed without updating the map fails CI.

#### Scenario: Mapping completeness
- **WHEN** the unit test scans `supabase/seed/matches.sql` for distinct `home_team` and `away_team` values that match a country (i.e. are not knockout placeholders)
- **THEN** every such value has a non-null `flagSlug(team)` result

### Requirement: Flags appear in match list, match detail, and my-picks views

The `/matches` list, the `/matches/[matchId]` scoreboard, and the `/my-picks` rows SHALL each render `TeamFlag` next to or alongside the team names. The leaderboard is explicitly out of scope.

#### Scenario: Matches list shows small flags
- **WHEN** a user views `/matches`
- **THEN** every row renders a small flag (or placeholder) for both `home_team` and `away_team`

#### Scenario: Match detail shows large flags
- **WHEN** a user views `/matches/<id>`
- **THEN** the scoreboard renders a large flag (or placeholder) flanking each team name

#### Scenario: My picks shows small flags
- **WHEN** a signed-in user views `/my-picks`
- **THEN** every pick row renders a small flag for both teams of that match

### Requirement: StageIcon renders a distinctive icon per match stage

The system SHALL provide a `StageIcon` component that renders a unique inline SVG for each match stage (`group`, `r32`, `r16`, `qf`, `sf`, `third`, `final`). For unknown stages, a neutral fallback icon SHALL be rendered.

#### Scenario: Group stage
- **WHEN** `<StageIcon stage="group" />` is rendered
- **THEN** the DOM contains a distinct SVG with `aria-hidden="true"` and no broken markup

#### Scenario: Final
- **WHEN** `<StageIcon stage="final" />` is rendered
- **THEN** the rendered SVG is visibly different from the SVG used for `group`, `r32`, `r16`, `qf`, `sf`, and `third`

#### Scenario: Used on match detail
- **WHEN** a user views `/matches/<id>`
- **THEN** the stage chip in the hero panel includes a `StageIcon` matching `match.stage`

### Requirement: VenueImage renders optional venue photos with a graceful fallback

The system SHALL provide a `VenueImage` component that renders a venue photo from `public/venues/<slug>.jpg` when the venue slug is present in a manifest (`lib/venues.ts`). When the venue is missing from the manifest (or the manifest is empty), the component SHALL render `null` (or a styled empty state) so the surrounding layout uses its existing fallback decoration.

#### Scenario: Venue with photo
- **WHEN** `<VenueImage venue="SoFi Stadium, Inglewood" />` is rendered AND `"sofi-stadium"` is present in `lib/venues.ts`
- **THEN** an `<img>` (or `next/image`) is rendered pointing at `/venues/sofi-stadium.jpg`

#### Scenario: Venue without photo
- **WHEN** `<VenueImage venue="SoFi Stadium, Inglewood" />` is rendered AND `"sofi-stadium"` is NOT in `lib/venues.ts`
- **THEN** the component renders nothing visible (the surrounding scoreboard uses its existing pitch-stripe background)

#### Scenario: Null venue
- **WHEN** `<VenueImage venue={null} />` is rendered
- **THEN** the component renders nothing

### Requirement: Match detail page animates on mount

The match detail page SHALL animate the hero scoreboard, stage chip, and (when final) score numerals into view on mount using CSS animations driven by `tw-animate-css` utility classes. Animations SHALL be GPU-friendly (opacity and transform only) and SHALL respect `prefers-reduced-motion`.

#### Scenario: Scoreboard mount animation
- **WHEN** a user with `prefers-reduced-motion: no-preference` opens `/matches/<id>`
- **THEN** the hero scoreboard fades in and slides up by ~12px over ~500ms

#### Scenario: Reduced motion respected
- **WHEN** a user with `prefers-reduced-motion: reduce` opens `/matches/<id>`
- **THEN** no fade/slide animation runs (the scoreboard appears in its final position immediately)

#### Scenario: Live badge pulses
- **WHEN** a user views `/matches/<id>` for a match with `status = 'live'`
- **THEN** the status badge has a pulsing visual cue (via `animate-pulse` or equivalent)

### Requirement: Matches list rows animate in with a stagger

The `/matches` list SHALL animate each row into view with a small fade + slide-up, staggered so successive rows enter ~20ms apart. The total stagger SHALL be capped (~800ms) so long days don't feel slow.

#### Scenario: Staggered entrance
- **WHEN** a user with `prefers-reduced-motion: no-preference` opens `/matches`
- **THEN** rows appear with successive ~20ms delays up to a maximum of ~800ms total

#### Scenario: Reduced motion respected
- **WHEN** a user with `prefers-reduced-motion: reduce` opens `/matches`
- **THEN** rows appear together with no entrance animation

### Requirement: Landing page renders a live countdown to the tournament's first match

The home page (`app/[locale]/page.tsx`) SHALL render a countdown band between the hero and the scoring section. The band SHALL display the time remaining until the earliest `kickoff_at` in `public.matches`, ticking once per second on the client, with localized day/hour/minute/second labels.

#### Scenario: Live countdown
- **WHEN** a visitor opens `/<locale>/` more than one second before the first match's kickoff
- **THEN** the page renders four stacked tiles labelled with the locale's words for days, hours, minutes, seconds
- **AND** the numeric values update once per second on the client

#### Scenario: Countdown sourced from the matches table
- **WHEN** an admin shifts the first match's `kickoff_at` in `public.matches`
- **THEN** the next home-page render targets the updated `kickoff_at`

#### Scenario: Fallback when the matches table is empty
- **WHEN** the home page renders against a database with no rows in `public.matches`
- **THEN** the countdown targets the constant `TOURNAMENT_START_ISO` (2026-06-11T19:00:00Z) exported from `lib/tournament.ts`

#### Scenario: Post-kickoff fallback
- **WHEN** a visitor opens the home page after the first match's kickoff has passed
- **THEN** the band collapses to a compact "Tournament live" pill localized to the visitor's locale
- **AND** no `setInterval` continues running for the countdown

#### Scenario: Locale labels match the active locale
- **WHEN** a visitor opens `/es/` and the countdown is live
- **THEN** the four tile labels are the Spanish words for days/hours/minutes/seconds (e.g. "Días", "Hrs", "Min", "Seg")

#### Scenario: Locale-aware subhead
- **WHEN** the live countdown renders for a visitor
- **THEN** the band includes a single subhead line naming the opening fixture and the kickoff date, rendered in the active locale

### Requirement: Matches list marks fixtures the signed-in user has already predicted

The `/matches` list SHALL display a "picked" indicator on every row for which the **currently authenticated** user has submitted a prediction. The indicator SHALL carry an accessible label sourced from the `matches.rowPicked` message. For anonymous (signed-out) visitors the list SHALL render exactly as before, with no picked indicator and no additional prediction query.

#### Scenario: Signed-in user sees picks marked

- **WHEN** an authenticated user who has predicted some fixtures opens `/matches`
- **THEN** each row whose match they have predicted shows the picked indicator
- **AND** rows they have not predicted show no picked indicator

#### Scenario: Anonymous visitor sees no indicators

- **WHEN** a signed-out visitor opens `/matches`
- **THEN** no row shows a picked indicator
- **AND** no per-user prediction query is issued

#### Scenario: Indicator is accessible

- **WHEN** the picked indicator is rendered for a row
- **THEN** it exposes the localized `matches.rowPicked` text to assistive technology (e.g. as an aria-label or visually-hidden label)

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

