# landing-live-matches Specification

## Purpose
TBD - created by syncing change landing-live-matches. Update Purpose after archive.
## Requirements
### Requirement: Display currently-live fixtures in the landing live section

The landing page "Tournament live" section SHALL display every fixture of the active
competition that is currently live. A fixture is live when its `status` is `live`, OR when
its `kickoff_at` is in the past AND its `status` is neither `final` nor `cancelled`. Each
displayed fixture MUST show both team names with their flags, the current score, and a
"Live" status badge, and MUST link to that fixture's match page. Fixtures MUST be ordered by
`kickoff_at` ascending.

#### Scenario: One match is live

- **WHEN** the tournament is live and exactly one fixture of the active competition is live
- **THEN** the section shows that fixture with both teams, their flags, the current score, and a "Live" badge linking to the match page

#### Scenario: Multiple matches are live

- **WHEN** two or more fixtures are live at the same time
- **THEN** the section lists each live fixture, ordered by kickoff time ascending

#### Scenario: A kicked-off match without explicit live status

- **WHEN** a fixture's `kickoff_at` is in the past and its `status` is `scheduled` (not yet `final` or `cancelled`)
- **THEN** the fixture is treated as live and included in the list

#### Scenario: Final and cancelled matches are excluded

- **WHEN** a fixture's `status` is `final` or `cancelled`
- **THEN** that fixture is NOT shown in the live list

### Requirement: Scores auto-refresh while matches are live

The live fixtures list SHALL refresh its data approximately every 30 seconds without a full
page reload, so scores and statuses stay current. Polling MUST pause while the browser tab is
hidden and resume (with an immediate refresh) when it becomes visible again. Polling MUST
stop when there are no live fixtures and the next upcoming kickoff is not imminent, and any
in-flight request MUST be cancelled when the component unmounts.

#### Scenario: Score updates without reload

- **WHEN** a live fixture's score changes on the server while the visitor is viewing the landing page
- **THEN** the displayed score updates within roughly one poll interval without a page reload

#### Scenario: Polling pauses on hidden tab

- **WHEN** the visitor switches to another tab so the page is hidden
- **THEN** polling pauses, and on returning to the tab the list refreshes immediately

#### Scenario: Polling stops when nothing is live

- **WHEN** no fixtures are live and the next kickoff is not imminent
- **THEN** polling stops until the page is reloaded or the next kickoff approaches

### Requirement: Next-up fallback when no match is in play

When the tournament is live but no fixture is currently in play, the section SHALL show the
soonest upcoming scheduled fixture (the next fixture whose `kickoff_at` is in the future) with
a kickoff countdown, instead of showing an empty list. Placeholder fixtures whose teams are
unresolved bracket slots (no resolvable flag) MUST NOT be used as the next-up fixture.

#### Scenario: Between kickoffs during the tournament

- **WHEN** the tournament is live and no fixture is currently live
- **THEN** the section shows the next upcoming fixture with its teams and a kickoff countdown

#### Scenario: Next-up skips placeholder bracket slots

- **WHEN** the soonest upcoming fixture has unresolved placeholder teams (e.g. "Winner R32-1")
- **THEN** that fixture is skipped and the next resolvable upcoming fixture is used, if any

### Requirement: Pre-tournament behavior is unchanged

Before the tournament is live (the opening kickoff is in the future), the section SHALL
continue to render the existing countdown to the opening match and MUST NOT render the live
fixtures list or the next-up fallback.

#### Scenario: Before the tournament starts

- **WHEN** the opening match kickoff is still in the future
- **THEN** the section shows the existing opening-match countdown and no live fixtures list

### Requirement: Localized live-section copy

All text introduced by the live fixtures section SHALL be provided through the i18n message
system for English, Spanish, and French, with no hardcoded user-facing strings. This includes
the heading, the "no match on right now" / next-up copy, and any per-fixture labels.

#### Scenario: Section rendered in a supported locale

- **WHEN** the landing page is rendered in English, Spanish, or French
- **THEN** all live-section text appears in that locale via message keys, with no hardcoded strings
