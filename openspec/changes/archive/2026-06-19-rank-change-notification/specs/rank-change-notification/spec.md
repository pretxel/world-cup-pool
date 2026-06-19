## ADDED Requirements

### Requirement: Pre-recompute rank snapshot

The system SHALL capture each ranked player's current overall-leaderboard rank
into a persisted `leaderboard_rank_snapshot` table before the sync-matches run
recomputes scores, so a previous-rank baseline survives the recompute. The
snapshot SHALL be keyed by `(competition_id, user_id)` and SHALL be upserted on
each run so it always holds the rank as of the previous run. The snapshot table
SHALL be readable and writable only by the service-role client (RLS enabled with
no policies).

#### Scenario: Snapshot taken before recompute

- **WHEN** the sync-matches cron handler runs
- **THEN** the system reads `user_id` and `rank` from `v_leaderboard_overall`
  for the active competition and upserts one snapshot row per ranked player
  **BEFORE** `runSync()` recomputes scores

#### Scenario: Snapshot failure does not abort the sync

- **WHEN** writing the rank snapshot throws
- **THEN** the error is logged and the sync run continues (score sync, events,
  emails, summaries) exactly as before

#### Scenario: Snapshot reflects the previous run

- **WHEN** a player's rank was 10 at the previous sync run and matches finalize
  in the current run
- **THEN** the snapshot read during the current run's email dispatch returns 10
  as that player's previous rank

### Requirement: Rank-delta computation in result dispatch

The result-email dispatch SHALL compute, for each affected player, a rank delta
from the player's snapshot previous rank and the new rank read from
`v_leaderboard_overall` during the same dispatch. The delta SHALL expose a
direction of `up`, `down`, `same`, or `new`, the magnitude of positions moved,
and the previous rank. A positive movement (lower rank number) MUST be reported
as `up`.

#### Scenario: Player moved up

- **WHEN** a player's snapshot rank is 10 and their new rank is 7
- **THEN** the computed delta has direction `up`, magnitude 3, and previous rank 10

#### Scenario: Player moved down

- **WHEN** a player's snapshot rank is 5 and their new rank is 8
- **THEN** the computed delta has direction `down`, magnitude 3, and previous rank 5

#### Scenario: Rank unchanged

- **WHEN** a player's snapshot rank equals their new rank
- **THEN** the computed delta has direction `same` and magnitude 0

#### Scenario: No prior snapshot

- **WHEN** a player has no snapshot row (first appearance on the leaderboard)
- **THEN** the computed delta has direction `new` and no previous rank

### Requirement: Rank delta rendered in the result email

The result email SHALL render the rank delta as a localized line within the
standing section in both the HTML and plain-text parts. An `up`/`down` delta
SHALL state the magnitude and the new rank (e.g. "you moved up 3 to #7"). A
`same` or `new` delta, or a missing delta, SHALL render a neutral variant and
MUST NOT show a numeric movement or break the email. The copy SHALL be available
in en, es, fr, and de under the `email` namespace.

#### Scenario: Upward movement copy

- **WHEN** the email is built for a player with an `up` delta of 3 to rank 7
- **THEN** the rendered HTML and text include a localized "moved up 3 to #7" line

#### Scenario: Neutral copy when no movement

- **WHEN** the email is built for a player with a `same` or `new` delta, or no
  delta is provided
- **THEN** the rendered email shows the neutral variant with no numeric delta and
  is otherwise unchanged

#### Scenario: Localized copy

- **WHEN** the result email copy is resolved for the default locale
- **THEN** the `email` namespace in en, es, fr, and de each provides the
  rank-delta keys used by the template

### Requirement: Graceful behavior on admin force-resend

The admin force-resend path (`forceDispatchResultEmails`) SHALL render the result
email with no rank delta, since an ad-hoc resend has no meaningful pre-state.

#### Scenario: Force-resend omits the delta

- **WHEN** an admin force-resends a result email for a single match
- **THEN** the email renders with the neutral (no-delta) variant and no error is
  raised
