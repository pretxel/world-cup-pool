# match-team-filter Specification

## Purpose
TBD - created by archiving change filter-matches-by-followed-team. Update Purpose after archive.
## Requirements
### Requirement: Matches page offers a team filter control

The `/matches` page SHALL render a team filter control above the match list consisting of an "All" option plus one selectable chip per distinct participating team present in the current schedule. The team set SHALL be derived from the fetched matches; knockout placeholder participants (values with no flag mapping, e.g. "2nd Group A") SHALL be excluded from the chip list. When no teams are selected, the "All" option SHALL be shown as active.

#### Scenario: Chips reflect scheduled teams
- **WHEN** a user views `/matches` and the schedule contains Brazil, Argentina, and Mexico (among others)
- **THEN** the filter control renders a selectable chip for Brazil, for Argentina, and for Mexico
- **AND** an "All" option is rendered and shown active

#### Scenario: Placeholders excluded from chips
- **WHEN** the schedule contains a fixture with participant "2nd Group A"
- **THEN** no filter chip is rendered for "2nd Group A"

### Requirement: Selecting teams filters the match list

When one or more teams are selected, the day-grouped match list SHALL show only matches whose `home_team` or `away_team` is in the selected set, compared against the exact seeded team names case-insensitively. Day groups left with zero matching fixtures SHALL be hidden. When no team is selected, every fixture SHALL be shown.

#### Scenario: Single team selected
- **WHEN** the user selects the Brazil chip
- **THEN** every visible match row involves Brazil as `home_team` or `away_team`
- **AND** matches not involving Brazil are not rendered

#### Scenario: Multiple teams selected
- **WHEN** the user selects both Brazil and Mexico
- **THEN** the visible rows are exactly the union of matches involving Brazil and matches involving Mexico

#### Scenario: Empty day groups hidden
- **WHEN** a filter is active and a given matchday has no fixture involving any selected team
- **THEN** that matchday section header is not rendered

#### Scenario: Reset to all
- **WHEN** the user activates the "All" option while a team filter is active
- **THEN** all fixtures are rendered and no team chip is shown active

### Requirement: Active filter is encoded in the URL

The active team selection SHALL be reflected in the page URL as a `team` query parameter so the filtered view is shareable and survives reload and browser back/forward navigation. The parameter SHALL carry the selected team names (comma-separated). On load, the server SHALL read the `team` parameter, ignore any value that is not a known participating team, and render the corresponding filtered list. Updating the selection SHALL preserve the locale path prefix and any unrelated query parameters.

#### Scenario: Selection writes the URL
- **WHEN** the user selects the Argentina chip on `/matches`
- **THEN** the URL updates to include `team=Argentina` (preserving the locale prefix)

#### Scenario: Filtered URL renders filtered list on load
- **WHEN** a user opens `/matches?team=Brazil` directly
- **THEN** the server renders only matches involving Brazil
- **AND** the Brazil chip is shown active

#### Scenario: Unknown param value ignored
- **WHEN** a user opens `/matches?team=Atlantis`
- **THEN** the page does not error
- **AND** the full unfiltered list is rendered (no valid team selected)

#### Scenario: Clearing selection clears the param
- **WHEN** the user activates "All" while `team=Brazil` is in the URL
- **THEN** the `team` parameter is removed from the URL

### Requirement: Header stats and day counts reflect the filtered set

The header stat counts (open / live / final) and each matchday's match-count label SHALL be computed from the filtered list, so the displayed totals always match the rows shown for the current selection.

#### Scenario: Stats follow the filter
- **WHEN** the user selects a team whose fixtures include 1 live and 2 final matches and nothing else
- **THEN** the header live stat reads 1 and the final stat reads the count among the filtered fixtures
- **AND** the totals do not count fixtures hidden by the filter

### Requirement: Filter-aware empty state

When a team filter is active and no fixture matches the selection, the page SHALL render an empty state that communicates the selection matched no fixtures and offers a way to clear the filter. This SHALL be distinct from the empty state shown when the schedule itself contains no matches.

#### Scenario: No fixtures for selection
- **WHEN** a filter is active and no scheduled fixture involves any selected team
- **THEN** a "no matches for the selected team(s)" empty state is rendered with a clear-filter affordance
- **AND** the generic "no matches scheduled" copy is not shown

### Requirement: Filter UI strings are localized

All user-facing strings introduced by the team filter (control label, "All" option, filtered empty state, clear-filter affordance) SHALL be provided through the existing `matches` i18n namespace and resolved for the active locale, with entries present in every supported locale message file.

#### Scenario: Localized label in each locale
- **WHEN** the matches page is rendered in `en`, `es`, and `fr`
- **THEN** the filter control label and "All" option render localized text from that locale's `matches` namespace (no missing-key fallback)

