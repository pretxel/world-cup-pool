## ADDED Requirements

### Requirement: Cron run dispatches result-standing emails after recomputing scores

After `runSync()` completes, the `/api/cron/sync-matches` route handler SHALL invoke result-email dispatch, which sends a standing-snapshot email to each player who had a prediction scored on a match that newly reached `final`, as defined by the `result-email-notifications` capability. Dispatch SHALL run only when result providers were available and the sync proceeded (not on a `204` short-circuit). The route's JSON summary MAY include an `emailed` count of messages sent in the run.

#### Scenario: Emails dispatched after a finalization run
- **WHEN** the cron run finalizes one or more matches and recomputes their scores
- **THEN** result-email dispatch runs after the sync
- **AND** affected players receive their standing-snapshot email

#### Scenario: No dispatch on env short-circuit
- **WHEN** the route short-circuits with `204 x-skipped: missing-env`
- **THEN** no email dispatch occurs

### Requirement: Email failures never fail or block the sync

The email dispatch step SHALL be isolated so that any error it raises is caught and logged, and the cron SHALL still return its sync summary. Per-recipient send errors SHALL be logged and counted without aborting the run or the remaining recipients. Email work SHALL NOT alter, delay, or roll back any score or match write performed by the sync.

#### Scenario: Dispatch throws
- **WHEN** result-email dispatch raises an error
- **THEN** the error is caught and logged
- **AND** the route still returns the sync summary with a 2xx status

#### Scenario: One recipient's send fails
- **WHEN** sending to one recipient fails but others succeed
- **THEN** the failure is logged and the successful recipients are still sent
- **AND** the failed recipient remains pending for the next run
