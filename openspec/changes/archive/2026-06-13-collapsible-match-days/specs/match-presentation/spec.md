## ADDED Requirements

### Requirement: Matchday groups on the matches list are collapsible

Each matchday section on the public `/matches` list SHALL be collapsible from its
day header. The day header SHALL act as an accessible disclosure control that
shows or hides that day's match rows without affecting any other day. When a day
is collapsed its match rows SHALL be hidden; when expanded they SHALL be shown.
The matchday label, the localized date, and the per-day match count SHALL remain
visible in the header in both states, and a chevron affordance SHALL indicate the
open/closed state. Collapsing one day SHALL NOT change the data, filters, or
ordering of the list.

#### Scenario: Collapse hides a day's rows

- **WHEN** a user activates the header of an expanded matchday on `/matches`
- **THEN** that day's match rows are hidden
- **AND** the matchday label, date, and match count remain visible in the header
- **AND** every other day's rows are unaffected

#### Scenario: Expand shows a collapsed day's rows

- **WHEN** a user activates the header of a collapsed matchday
- **THEN** that day's match rows become visible again

#### Scenario: Disclosure semantics are accessible

- **WHEN** a matchday header is rendered
- **THEN** it is operable as a button (keyboard and pointer)
- **AND** it exposes `aria-expanded` reflecting the open/closed state
- **AND** it is associated with the region containing that day's rows (e.g. via `aria-controls`)
- **AND** it carries a localized accessible label for the expand/collapse action sourced from the `matches` messages

#### Scenario: Chevron reflects state

- **WHEN** a matchday is expanded versus collapsed
- **THEN** the header's chevron affordance visibly differs between the two states (e.g. rotated)

### Requirement: Matchday collapse state persists and defaults by status

The collapsed/expanded state of each matchday on `/matches` SHALL persist across
page reloads and in-app navigation, keyed per day, using client-side storage.
When no stored state exists for a day, the default SHALL be derived from the
day's matches: a day whose matches are all finished (final or cancelled) SHALL
default to collapsed, and any other day (containing scheduled, locked, or live
matches) SHALL default to expanded. When client-side storage is unavailable the
list SHALL still render using the status-derived defaults without error.

#### Scenario: State survives reload

- **WHEN** a user collapses a matchday and then reloads `/matches`
- **THEN** that matchday is still collapsed after reload
- **AND** days the user did not toggle retain their default state

#### Scenario: Finished day defaults collapsed

- **WHEN** a user with no stored state opens `/matches` and a day's matches are all final or cancelled
- **THEN** that day starts collapsed

#### Scenario: Active day defaults expanded

- **WHEN** a user with no stored state opens `/matches` and a day contains at least one scheduled, locked, or live match
- **THEN** that day starts expanded

#### Scenario: Storage unavailable degrades gracefully

- **WHEN** client-side storage is unavailable or throws
- **THEN** `/matches` still renders each day using its status-derived default state
- **AND** no error is surfaced to the user

#### Scenario: Rows present without client JavaScript

- **WHEN** `/matches` is rendered without client-side JavaScript executing
- **THEN** each day's match rows are present in the document
- **AND** days that default to expanded show their rows

## MODIFIED Requirements

### Requirement: Sticky day headers keep correct offset on all devices

The sticky matchday headers on `/matches` SHALL remain pinned directly below the
site navigation, without gap or overlap, at both mobile and desktop viewport
widths. The headers act as collapse/expand disclosure controls; making them
operable as buttons SHALL NOT change their sticky positioning or offset.

#### Scenario: Sticky header on mobile
- **WHEN** a user scrolls the `/matches` list in a viewport narrower than 640px
- **THEN** the active matchday header sticks immediately below the site navigation with no visual overlap of row content behind the nav

#### Scenario: Sticky header on desktop
- **WHEN** a user scrolls the `/matches` list in a viewport 1024px wide or wider
- **THEN** the active matchday header sticks immediately below the site navigation

#### Scenario: Sticky offset unchanged by disclosure control
- **WHEN** the matchday header renders as a collapse/expand button
- **THEN** it remains pinned directly below the site navigation with the same offset as before, with no gap or overlap
