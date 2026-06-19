# match-row-lock-urgency

## Purpose

Surface a closing-soon urgency signal on the public `/matches` fixture rows: a still-pickable (scheduled, unlocked) row whose kickoff is imminent shows a live "closes in mm:ss" countdown badge plus subtle urgency styling in place of its static "Pick" affordance, nudging the user to pick before the kickoff lock and resolving to the locked state on the client when kickoff hits — without changing the lock rules, the data fetch, or any other row state.

## Requirements

### Requirement: Closing-soon urgency badge on imminent pickable rows

On the public matches list, a fixture row that is still pickable (scheduled and unlocked) and whose kickoff is imminent — within a fixed lead window of at most five minutes — SHALL display a live countdown badge indicating the pick window is closing soon (e.g. "closes in 4:32"), in place of the row's static "Pick" affordance. The badge SHALL count down at second resolution from the visitor's own clock.

#### Scenario: Pickable fixture kicks off within the lead window
- **WHEN** a scheduled, unlocked fixture's kickoff is within the lead window (at most five minutes away) and the user has not yet locked into the locked state for it
- **THEN** that row shows a live "closes in mm:ss" countdown badge instead of the static "Pick" label
- **AND** the countdown decrements every second toward kickoff

#### Scenario: Pickable fixture is not yet imminent
- **WHEN** a scheduled, unlocked fixture's kickoff is further away than the lead window
- **THEN** the row shows its normal static "Pick" label with no countdown badge and no urgency styling

### Requirement: Subtle urgency styling on imminent rows

A row in the closing-soon state SHALL receive subtle urgency styling that is visually distinct from the live-match and locked-match treatments, so a user scanning the list can tell the pick window is about to close without the row being mistaken for an in-progress or already-locked match. The styling SHALL be additive: no other column or affordance in the row changes.

#### Scenario: Imminent row is visually distinguished
- **WHEN** a row is in the closing-soon state
- **THEN** it carries urgency styling distinct from the live "on now" treatment and the muted "Locked" treatment
- **AND** the time, stage badge, teams, venue, and chevron in that row are unchanged

### Requirement: Countdown resolves to the locked state at kickoff

When the closing-soon countdown reaches kickoff on the client, the badge SHALL resolve to the locked state — showing the existing locked label — matching what a fresh server render would show once the fixture is locked, without requiring a page reload or refetch. The lock boundary SHALL remain exactly at kickoff; the badge SHALL NOT extend or shorten the pickable window.

#### Scenario: Kickoff is reached while the list is open
- **WHEN** a closing-soon countdown reaches zero (kickoff) while the list is open
- **THEN** the badge swaps to the locked label for that row
- **AND** no page reload or new data fetch is required for the row to reflect the lock

#### Scenario: Fixture already past kickoff when the row mounts
- **WHEN** a row server-rendered as scheduled is already past kickoff by the time the countdown evaluates on the client
- **THEN** the badge shows the locked label rather than a negative or stale "closes in" time

### Requirement: Non-pickable and picked rows are unaffected

The urgency state SHALL apply only to scheduled, unlocked rows. Live, locked, final, cancelled, and already-picked rows SHALL keep their current badges and styling with no countdown and no urgency treatment.

#### Scenario: Live, locked, final, or cancelled row
- **WHEN** a row's status is live, locked, final, or cancelled
- **THEN** it shows its existing badge (on now / Locked / final score) with no closing-soon countdown or urgency styling

#### Scenario: Already-picked imminent fixture
- **WHEN** a fixture is imminent but the signed-in user has already submitted a pick for it
- **THEN** the row keeps its picked indicator and shows no closing-soon urgency badge

### Requirement: Localized closing-soon copy

The closing-soon badge's text SHALL render in the active locale across the supported locales (en, es, fr, de), with the numeric countdown interpolated into the localized phrase.

#### Scenario: Localized rendering
- **WHEN** a closing-soon badge is shown under a supported locale
- **THEN** its closing-soon phrasing renders in that locale with the mm:ss countdown interpolated
