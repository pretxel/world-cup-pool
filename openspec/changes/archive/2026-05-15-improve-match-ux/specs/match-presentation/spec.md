## ADDED Requirements

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
