## MODIFIED Requirements

### Requirement: Public matches list shows only confirmed matches

The `/matches` list SHALL render a fixture when it is **confirmed** (both teams resolve to real countries) **or** its knockout round is **revealed** by an admin. All other unconfirmed fixtures SHALL be excluded before team-filtering, header stat computation, and day grouping. Confirmed fixtures SHALL always appear regardless of any reveal flag, with no separate publish action when an admin sets both real teams. A revealed-but-unconfirmed fixture SHALL render as a read-only schedule row (placeholder participant text, date, venue, stage) and SHALL NOT show a "Pick" control.

#### Scenario: Placeholder fixtures hidden when their round is not revealed
- **WHEN** a visitor opens `/matches` while the schedule contains group fixtures and knockout fixtures with placeholder teams whose rounds are not revealed
- **THEN** only the confirmed (real-team) fixtures are rendered
- **AND** no row shows a placeholder participant such as "2nd Group A"

#### Scenario: Revealed round shows placeholder fixtures read-only
- **WHEN** an admin has revealed a knockout round and a visitor opens `/matches`
- **THEN** that round's fixtures appear with their date, venue, and placeholder participants
- **AND** those unconfirmed rows show no "Pick" control

#### Scenario: Stats reflect the visible set
- **WHEN** the list is gated to the visible set (confirmed plus revealed-round fixtures)
- **THEN** the header open/live/final stats and each matchday count are computed over that visible set

#### Scenario: Confirming a match reveals it
- **WHEN** an admin sets both teams of a knockout fixture to real countries
- **AND** a visitor reloads `/matches`
- **THEN** that fixture now appears in the list
