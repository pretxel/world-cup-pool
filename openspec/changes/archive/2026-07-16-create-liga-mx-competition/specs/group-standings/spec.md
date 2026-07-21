# group-standings Specification

## MODIFIED Requirements

### Requirement: Dedicated public standings page

The system SHALL expose a public, locale-aware `/standings` page that renders every group's real standings table for the active competition and is reachable without authentication. When the active competition has a `league`-kind stage, the page SHALL render a single league table instead of a group table grid. The primary navigation SHALL include a link to this page.

#### Scenario: Group-format competition renders group grid

- **WHEN** the active competition has `groups.enabled = true` (e.g., World Cup 2026)
- **THEN** `/standings` renders a grid of group tables, one per group

#### Scenario: League-format competition renders single table

- **WHEN** the active competition has `groups.enabled = false` and a `league`-kind stage (e.g., Liga MX)
- **THEN** `/standings` renders a single league standings table showing all teams in rank order (P/W/D/L/GF/GA/GD/Pts)
- **AND** the table heading reflects the league stage label (e.g., "Clasificación General" in Spanish)

#### Scenario: Anonymous visitor views standings

- **WHEN** an unauthenticated visitor opens `/standings`
- **THEN** the page renders the standings (group or league) computed from synced results
- **AND** no login is required

#### Scenario: Localized rendering

- **WHEN** the page is requested under a supported locale (en, es, fr)
- **THEN** its headings, captions, and empty states render in that locale

### Requirement: Graceful handling when no group or league stage exists

When the active competition has no group stage and no league stage (or no fixtures), the system SHALL render an informative empty state on the standings page instead of an error or a 404.

#### Scenario: Competition without standings

- **WHEN** the active competition's format defines no group stage and no league stage
- **THEN** `/standings` renders an empty state explaining no standings are available
- **AND** the request does not error
