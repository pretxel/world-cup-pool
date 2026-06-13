# match-day-grouping Specification

## Purpose
TBD - created by archiving change group-matches-by-browser-timezone. Update Purpose after archive.
## Requirements
### Requirement: Matches are grouped by the visitor's local calendar day

The `/matches` list SHALL group fixtures into day sections by the calendar day of each match's `kickoff_at` **in the visitor's timezone**, so that every match appears under the same calendar day that its displayed local kickoff time falls on. The day key SHALL be a sortable `YYYY-MM-DD` string computed for the kickoff instant in the visitor's IANA timezone, preserving the existing chronological day ordering derived from `kickoff_at` ascending.

#### Scenario: Late kickoff bucketed by local day

- **WHEN** a visitor in `America/Los_Angeles` (UTC-7/8) views `/matches` and a match kicks off at `2026-06-13T02:00:00Z` (i.e. 19:00 local on 2026-06-12)
- **THEN** that match appears in the day section for 2026-06-12 (the visitor's local day), not 2026-06-13

#### Scenario: Day section split across local midnight

- **WHEN** two matches share a single UTC calendar day but fall on different calendar days in the visitor's timezone
- **THEN** they are rendered under two separate day sections, each headed by its own local date

#### Scenario: Per-day count reflects local buckets

- **WHEN** the visitor views `/matches`
- **THEN** each day section's match count and its default-collapsed state (collapsed only when every match in that local day is `final` or `cancelled`) are computed over the matches in that local day bucket

### Requirement: Browser timezone is detected and persisted for server-side grouping

The system SHALL detect the visitor's IANA timezone on the client via `Intl.DateTimeFormat().resolvedOptions().timeZone` and persist it in a first-party cookie readable by the server during rendering. When the detected timezone differs from the persisted cookie value, the client SHALL update the cookie and trigger a re-render of the server-rendered list so grouping reflects the current timezone. The cookie SHALL NOT be required to be `HttpOnly` (the client must write it), SHALL use `SameSite=Lax` and `Path=/`, and SHALL carry only the IANA timezone name.

#### Scenario: Timezone synced on first visit

- **WHEN** a visitor opens `/matches` with no timezone cookie set
- **THEN** the client writes the detected IANA timezone to the cookie
- **AND** the server-rendered list is refreshed so subsequent rendering groups by the visitor's local day

#### Scenario: Timezone change re-syncs

- **WHEN** the cookie holds a timezone that no longer matches `Intl.DateTimeFormat().resolvedOptions().timeZone` (e.g. the visitor traveled)
- **THEN** the client updates the cookie to the new timezone and the list re-renders grouped by the new local day

#### Scenario: No cookie write when timezone unchanged

- **WHEN** the persisted cookie already equals the detected timezone
- **THEN** the client does not rewrite the cookie or trigger a refresh

### Requirement: Deterministic UTC fallback when timezone is unknown

When no valid timezone is available to the server (no cookie on first visit, or an invalid/unparseable cookie value), the system SHALL group matches by their UTC calendar day, and SHALL NOT throw. An invalid timezone value SHALL be treated as unknown and SHALL fall back to UTC grouping rather than erroring.

#### Scenario: First render before cookie exists

- **WHEN** the server renders `/matches` and no timezone cookie is present
- **THEN** matches are grouped by UTC calendar day for a deterministic render with no hydration mismatch

#### Scenario: Invalid cookie value

- **WHEN** the timezone cookie holds a value that is not a valid IANA timezone (e.g. `not-a-zone`)
- **THEN** grouping falls back to UTC day without throwing

### Requirement: Day header date and collapse state use the same local day key

The day section header date and the per-day collapse-state storage key SHALL both derive from the same `YYYY-MM-DD` local day key used for grouping. The header SHALL display that local calendar date directly (not by reformatting a synthetic UTC-midnight instant), and the collapse state persisted in `localStorage` SHALL be keyed by the local day key so a visitor's expand/collapse choice is stable for that local day.

#### Scenario: Header date matches the bucket

- **WHEN** a day section groups matches for the visitor's local day 2026-06-12
- **THEN** the section header displays the date 2026-06-12 (in the visitor's locale formatting), consistent with the kickoff times listed in that section

#### Scenario: Collapse choice persists per local day

- **WHEN** a visitor collapses the day section for their local day 2026-06-12 and later reloads `/matches`
- **THEN** that section is restored to collapsed, keyed by the 2026-06-12 local day key

