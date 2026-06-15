## ADDED Requirements

### Requirement: Match events are stored in a dedicated timeline model

The system SHALL persist per-match play-by-play events in a `match_events` table keyed to `matches(id)` with `on delete cascade`. Each row SHALL carry a normalized `type`, an optional `team` (`'home'`/`'away'`/null for neutral markers), an optional `minute` and `extra_minute`, a monotonic `sequence` used for ordering within the match, an optional `player` and `detail` label, the source `provider` and its `provider_event_id`, and the raw `payload`. Ingestion SHALL be idempotent via a unique key on `(match_id, provider, provider_event_id)`. The table SHALL allow public `select` and SHALL restrict writes to the service role used by the sync.

#### Scenario: Event persisted with ordering key
- **WHEN** an event is ingested for a match
- **THEN** a `match_events` row is written with its `type`, `team`, `minute`, `sequence`, and `provider_event_id`
- **AND** ordering the match's events by `sequence` yields chronological order

#### Scenario: Re-ingesting the same event is idempotent
- **WHEN** the same provider event (same `match_id`, `provider`, `provider_event_id`) is ingested again
- **THEN** the existing row is updated in place rather than duplicated
- **AND** the match's event count is unchanged

#### Scenario: Public can read, only sync can write
- **WHEN** an unauthenticated client reads a match's events
- **THEN** the read succeeds
- **AND** a client write to `match_events` is rejected by row-level security

### Requirement: Per-match live API returns score, status, and events

The system SHALL expose `GET /api/matches/[matchId]/live` returning a JSON object with the match `status`, `homeScore`, `awayScore`, `kickoffAt`, an `isLive` flag, an `updatedAt` timestamp, and an `events` array ordered chronologically. The response SHALL set `Cache-Control: no-store`. An unknown match id SHALL return `404`.

#### Scenario: Live payload shape
- **WHEN** a client requests `/api/matches/<id>/live` for an existing match
- **THEN** the response is `200` with `status`, `homeScore`, `awayScore`, `isLive`, `updatedAt`, and an ordered `events` array
- **AND** the response carries `Cache-Control: no-store`

#### Scenario: Unknown match
- **WHEN** the requested match id does not exist
- **THEN** the response status is `404`

#### Scenario: No events yet
- **WHEN** a match has no ingested events
- **THEN** the response returns an empty `events` array (not an error)

### Requirement: Live API opportunistically refreshes in-progress matches

When `GET /api/matches/[matchId]/live` is requested for a match whose `isLive` is true, the system SHALL schedule a debounced ESPN event+score sync scoped to that single match after the response is sent, without blocking the response. The per-match trigger SHALL be debounced so a given server instance attempts at most one sync per match per short window (≈15–20s). For non-live matches the request SHALL NOT schedule any sync.

#### Scenario: Live request schedules a scoped sync
- **WHEN** the live API is requested for a match with `isLive` true and no recent trigger for that match on this instance
- **THEN** a sync scoped to that match is scheduled after the response completes
- **AND** the response is not delayed by the sync

#### Scenario: Debounce suppresses rapid repeats
- **WHEN** the live API is requested for the same live match twice within the debounce window on the same instance
- **THEN** only the first request schedules a sync

#### Scenario: Final match does not trigger sync
- **WHEN** the live API is requested for a match whose status is `final`
- **THEN** no sync is scheduled

### Requirement: Match-detail page shows a polling live feed for in-progress matches

The match-detail page SHALL mount a live feed component for matches that are not `final` or `cancelled`. The component SHALL poll the per-match live API on an interval (≈15s) while the match is in progress, update the displayed score and status in place when they change, and render the event timeline newest-first. Polling SHALL stop once the match reaches `status='final'`. For matches already `final` or `cancelled` on load, no polling SHALL occur.

#### Scenario: Live match updates without reload
- **WHEN** a user views a match that is live and a new event/score is ingested
- **THEN** the feed reflects the new score/status and event on its next poll without a full-page reload

#### Scenario: Polling stops at full time
- **WHEN** a polled match transitions to `status='final'`
- **THEN** the feed renders the final state and stops polling

#### Scenario: Final match does not poll
- **WHEN** a user opens a match that is already `final`
- **THEN** the page renders the result statically with no polling

### Requirement: Live feed pauses with tab visibility and shares one polling mechanism

The live feed and the landing `LiveMatchList` SHALL both use a single shared polling utility that pauses polling while the document is hidden, refetches immediately when the tab regains focus, stops when its stop-condition is met, and cancels any in-flight request on unmount. Refactoring `LiveMatchList` onto the shared utility SHALL preserve its existing behavior (30s interval, live/next-up stop condition).

#### Scenario: Hidden tab pauses polling
- **WHEN** the document becomes hidden while a feed is polling
- **THEN** polling pauses
- **AND** when the tab becomes visible again an immediate refetch occurs

#### Scenario: Landing list behavior preserved
- **WHEN** the landing `LiveMatchList` runs on the shared utility
- **THEN** it still polls every 30s, pauses when hidden, and stops when there are no live fixtures and the next kickoff is more than 30s away

### Requirement: Live feed is accessible and locale-aware

The live feed SHALL expose exactly one `aria-live="polite"` status region so assistive technology announces updates once rather than per element. New events SHALL animate in only under `motion-safe`. All feed chrome and event-type labels SHALL be localized (`en`/`es`/`fr`); event `type` values SHALL map to localized labels client-side, while provider-supplied player and team names render as-is. The feed SHALL show a graceful empty state when a live match has no events yet.

#### Scenario: Single announced region
- **WHEN** the feed updates with new events
- **THEN** assistive technology encounters a single polite live region rather than one announcement per placeholder

#### Scenario: Localized event labels
- **WHEN** a `goal` event renders under the `es` locale
- **THEN** its label is shown in Spanish
- **AND** the player and team names are shown as provided by the source

#### Scenario: Reduced motion
- **WHEN** a user with `prefers-reduced-motion: reduce` receives new events
- **THEN** the entries appear without animation
