## ADDED Requirements

### Requirement: Sync ingests play-by-play events from ESPN

The result sync SHALL, in addition to the existing score/status mapping, fetch per-match play-by-play events from the ESPN summary endpoint and persist them into `match_events`, normalizing each provider event to the shared event shape (`type`, `team`, `minute`, `extra_minute`, `sequence`, `player`, `detail`, `provider`, `provider_event_id`, `payload`) before writing. Persistence SHALL be an idempotent upsert keyed on `(match_id, provider, provider_event_id)`. The ESPN endpoint SHALL be derived from the active competition's `providers` configuration rather than hardcoded. The score/status mapping and its provider chain SHALL remain unchanged by this addition.

#### Scenario: Events ingested for a live match
- **WHEN** the sync processes a match that ESPN reports as in progress with play-by-play events
- **THEN** each event is normalized and upserted into `match_events`
- **AND** the match's score/status write follows the existing mapping unchanged

#### Scenario: Idempotent re-ingestion
- **WHEN** the sync runs again and ESPN returns the same events
- **THEN** existing `match_events` rows are updated in place rather than duplicated

#### Scenario: ESPN endpoint from competition config
- **WHEN** the active competition supplies an ESPN summary path in its `providers` config
- **THEN** the event fetch builds its URL from that config rather than a hardcoded World Cup endpoint

### Requirement: Event ingestion is isolated and never fails the sync

Event ingestion SHALL be isolated so that any error it raises (ESPN fetch failure, parse error, or write error) is caught and logged, the run still completes, and the score/status writes are neither blocked, delayed, nor rolled back. The run summary MAY include an `events` count of rows upserted.

#### Scenario: ESPN event fetch fails
- **WHEN** the ESPN summary fetch errors during a run
- **THEN** the error is caught and logged
- **AND** the run still applies score/status writes and returns its summary with a 2xx status

#### Scenario: Score sync unaffected by event step
- **WHEN** event ingestion fails for one match
- **THEN** that match's score/status mapping still applies normally
- **AND** other matches are unaffected

### Requirement: Per-match opportunistic live-event sync

The system SHALL provide a per-match sync trigger, distinct from the matches-page trigger, that the per-match live API schedules for in-progress matches. It SHALL fetch and apply that single match's ESPN events (and score/status) after the API response is sent, debounced so a given server instance attempts at most one run per match within a short window (≈15–20s). It SHALL never run for matches that are `final` or `cancelled`.

#### Scenario: Live match view refreshes events
- **WHEN** the per-match live API is hit for an in-progress match outside the debounce window
- **THEN** a sync scoped to that match is scheduled after the response, refreshing its events and score

#### Scenario: Debounced repeats
- **WHEN** the per-match trigger fires twice for the same match within the debounce window on one instance
- **THEN** only the first schedules a run

#### Scenario: No run for terminal matches
- **WHEN** the per-match trigger is evaluated for a `final` or `cancelled` match
- **THEN** no sync is scheduled
