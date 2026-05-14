## ADDED Requirements

### Requirement: Predictions immutable once match leaves scheduled state

The system SHALL reject any attempt to insert or update a prediction for a match whose `status` is not `scheduled`, regardless of the match's `kickoff_at` value. This rule SHALL be enforced at the database row-level-security layer.

#### Scenario: Match is final
- **WHEN** an authenticated user submits a prediction for a match whose `status = 'final'`
- **THEN** the database rejects the write with a row-level-security violation
- **AND** the user's existing prediction (if any) for that match is unchanged

#### Scenario: Match is live
- **WHEN** an authenticated user submits a prediction for a match whose `status = 'live'`
- **THEN** the database rejects the write with a row-level-security violation

#### Scenario: Match is cancelled
- **WHEN** an authenticated user submits a prediction for a match whose `status = 'cancelled'`
- **THEN** the database rejects the write with a row-level-security violation

#### Scenario: Match is final but kickoff_at is in the future
- **WHEN** a match has `status = 'final'` AND `kickoff_at > now()` (e.g. admin shifted the kickoff time post-finalization)
- **AND** an authenticated user submits a prediction for that match
- **THEN** the database rejects the write with a row-level-security violation

### Requirement: Predictions still locked at kickoff for scheduled matches

The system SHALL continue to reject inserts and updates to predictions for matches whose `status = 'scheduled'` once `kickoff_at <= now()`. This preserves the existing kickoff-time lock.

#### Scenario: Scheduled match past kickoff
- **WHEN** an authenticated user submits a prediction for a match whose `status = 'scheduled'` AND `kickoff_at <= now()`
- **THEN** the database rejects the write with a row-level-security violation

#### Scenario: Scheduled match before kickoff
- **WHEN** an authenticated user submits a prediction for a match whose `status = 'scheduled'` AND `kickoff_at > now()`
- **THEN** the database accepts the write

### Requirement: Server action returns a status-specific lock message

The `submitPrediction` server action SHALL pre-fetch the target match's `status` and `kickoff_at` and return a typed error result describing the specific lock reason before attempting the database write.

#### Scenario: Final match
- **WHEN** `submitPrediction` is called with a `matchId` whose match has `status = 'final'`
- **THEN** the action returns `{ ok: false, error: "Predictions are locked — match is final." }`
- **AND** no row is written to `public.predictions`

#### Scenario: Cancelled match
- **WHEN** `submitPrediction` is called with a `matchId` whose match has `status = 'cancelled'`
- **THEN** the action returns `{ ok: false, error: "Predictions are locked — match was cancelled." }`

#### Scenario: Live match
- **WHEN** `submitPrediction` is called with a `matchId` whose match has `status = 'live'`
- **THEN** the action returns `{ ok: false, error: "Predictions are locked — match is live." }`

#### Scenario: Scheduled match past kickoff
- **WHEN** `submitPrediction` is called with a `matchId` whose match has `status = 'scheduled'` AND `kickoff_at <= now()`
- **THEN** the action returns `{ ok: false, error: "Predictions are locked — kickoff has passed." }`

#### Scenario: Scheduled match before kickoff
- **WHEN** `submitPrediction` is called for a match with `status = 'scheduled'` AND `kickoff_at > now()`
- **AND** the payload is valid
- **THEN** the action upserts the prediction and returns `{ ok: true }`

### Requirement: Lock helper accounts for match status

The `isLocked` helper in `lib/match-utils.ts` SHALL return `true` whenever the match `status` is not `scheduled`, and SHALL continue to return `true` when `status = 'scheduled'` but `kickoff_at <= now()`.

#### Scenario: Non-scheduled status
- **WHEN** `isLocked({ kickoff_at, status })` is called with `status ∈ { 'live', 'final', 'cancelled' }`
- **THEN** the helper returns `true` regardless of the `kickoff_at` value

#### Scenario: Scheduled status before kickoff
- **WHEN** `isLocked({ kickoff_at, status: 'scheduled' })` is called with `kickoff_at > now()`
- **THEN** the helper returns `false`

#### Scenario: Scheduled status after kickoff
- **WHEN** `isLocked({ kickoff_at, status: 'scheduled' })` is called with `kickoff_at <= now()`
- **THEN** the helper returns `true`

### Requirement: Match detail page surfaces the lock reason

The match detail page at `/matches/[matchId]` SHALL display lock-state copy that reflects why the match is locked when the user is signed in and the match is locked.

#### Scenario: Final match copy
- **WHEN** a signed-in user views a match with `status = 'final'`
- **THEN** the prediction zone shows a locked banner referring to the match being final, not "kickoff has passed"

#### Scenario: Cancelled match copy
- **WHEN** a signed-in user views a match with `status = 'cancelled'`
- **THEN** the prediction zone shows a locked banner indicating the match was cancelled

#### Scenario: Pre-kickoff scheduled match
- **WHEN** a signed-in user views a match with `status = 'scheduled'` AND `kickoff_at > now()`
- **THEN** the prediction form is rendered and editable
