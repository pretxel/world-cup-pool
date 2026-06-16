## ADDED Requirements

### Requirement: Landing live data source keeps scores fresh by triggering result sync

The endpoint that serves the landing live fixtures (`GET /api/live-matches`) SHALL
trigger an opportunistic result sync for the fixtures it reports as currently live, so
that the scores the section polls actually advance from the upstream provider. The sync
SHALL be scheduled to run after the response is sent (non-blocking): the endpoint SHALL
return the current database snapshot immediately and SHALL NOT wait for the sync, so a
freshly synced score becomes visible on a subsequent poll rather than delaying the
current one. The sync SHALL be scheduled only for fixtures that are currently live;
fixtures whose `status` is `final` or `cancelled`, and the next-up fallback fixture when
no fixture is in play, SHALL NOT be scheduled. Repeated polls (including concurrent polls
from many visitors) SHALL be de-duplicated by the existing per-match sync throttle so they
do not multiply upstream provider calls, and the number of fixtures scheduled per request
SHALL be bounded by a fixed cap.

#### Scenario: Polling a live fixture schedules a sync

- **WHEN** the landing live endpoint is polled and at least one fixture is currently live
- **THEN** an opportunistic result sync is scheduled for each currently-live fixture (subject to the throttle and per-request cap)
- **AND** the response returns the current scores without waiting for the sync to complete

#### Scenario: Synced score appears on the next poll

- **WHEN** a live fixture's score changes upstream and a scheduled sync writes the new score to the database
- **THEN** the next poll of the landing live endpoint returns the updated score

#### Scenario: Terminal and next-up fixtures are not synced

- **WHEN** the endpoint is polled while a fixture is `final` or `cancelled`, or while no fixture is live and only a next-up fallback fixture is returned
- **THEN** no result sync is scheduled for that fixture

#### Scenario: Repeated polls are throttled

- **WHEN** the endpoint is polled again for the same live fixture within the per-match throttle window
- **THEN** no additional sync is scheduled for that fixture until the window elapses

#### Scenario: Sync failure does not break the response

- **WHEN** a scheduled sync errors or the provider is unavailable
- **THEN** the landing live endpoint still returns its payload normally and the failure does not surface to the visitor
