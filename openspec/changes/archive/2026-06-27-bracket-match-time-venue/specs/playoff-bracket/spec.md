## ADDED Requirements

### Requirement: Bracket card shows kickoff time and venue

Each rendered bracket card (Round of 32 through the Final, including the third-place play-off) SHALL display the fixture's kickoff time and its stadium (venue). The kickoff time SHALL be presented in the visitor's local timezone and locale, with a deterministic server-rendered fallback so the page hydrates without mismatch. When a fixture has no recorded venue, the card SHALL omit the venue without rendering an empty placeholder or separator. This is a presentational addition only — it SHALL NOT alter slot resolution, provisional/confirmed status, FIFA match numbering, or the live-refresh behavior.

#### Scenario: Card shows kickoff time and stadium

- **WHEN** a bracket card renders a fixture that has a kickoff time and a venue
- **THEN** the card displays the fixture's kickoff time and its stadium name

#### Scenario: Kickoff time localized to the visitor

- **WHEN** a visitor views a bracket card after the page has hydrated
- **THEN** the kickoff time is shown in the visitor's local timezone and locale
- **AND** the server-rendered output (before hydration) shows a deterministic fallback so no hydration mismatch occurs

#### Scenario: Venue omitted when unknown

- **WHEN** a bracket card renders a fixture with no recorded venue
- **THEN** the card shows the kickoff time but omits the venue, with no empty line, "null", or dangling separator

#### Scenario: Display addition does not change resolution

- **WHEN** the kickoff time and venue are added to the cards
- **THEN** the resolved participants, provisional/confirmed status, match numbering, and live-refresh behavior are unchanged
