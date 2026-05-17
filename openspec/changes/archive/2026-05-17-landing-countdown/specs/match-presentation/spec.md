## ADDED Requirements

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
