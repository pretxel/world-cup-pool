## ADDED Requirements

### Requirement: All traffic redirects to winscore.me

The system SHALL redirect every incoming HTTP request from the old domain to `https://winscore.me/` with a 308 Permanent Redirect status code.

#### Scenario: Page request redirects
- **WHEN** a browser requests any path on the old domain (e.g., `/en/matches`, `/admin`, `/api/cron/sync-matches`)
- **THEN** the server responds with HTTP 308 and a `Location` header set to `https://winscore.me/`

#### Scenario: Static asset request redirects
- **WHEN** a browser requests a static asset on the old domain (e.g., `/favicon.ico`, `/flags/en.svg`)
- **THEN** the server responds with HTTP 308 and a `Location` header set to `https://winscore.me/`

#### Scenario: Root domain redirects
- **WHEN** a browser requests the root path `/` on the old domain
- **THEN** the server responds with HTTP 308 and a `Location` header set to `https://winscore.me/`
