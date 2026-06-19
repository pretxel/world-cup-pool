# streak-freeze Specification

## Purpose

Soften the streak cliff by giving each user a small, weekly-refilled allowance
of freeze tokens, per streak kind, that automatically forgive a single one-day
gap so a quiz or prediction streak is not reset — implementing the engagement
*apuesta grande* "Streak freeze / pase semanal". Both streaks are pure functions
computed on read (`computeStreak` in `lib/quiz.ts`, `computePredictionStreak` in
`lib/prediction-streak.ts`); freezes are recorded in a per-user ledger and fed
into those functions as data, keeping them pure, deterministic, and idempotent.

## ADDED Requirements

### Requirement: Per-user, per-kind freeze ledger

The system SHALL persist freeze state in a per-user ledger that is keyed by
streak kind (`quiz` and `prediction`), recording both the weekly freeze
allowance granted for a user+kind+week and each specific UTC day on which a
freeze was consumed to bridge a gap. The ledger MUST make consumption idempotent
via a uniqueness guarantee on (user, kind, consumed UTC day), so the same gap day
can be charged at most once. Reads of the ledger MUST be restricted to the owning
user by row-level security, and the consumed-day and weekly-grant rows MUST NOT
be insertable directly by an untrusted client (minting/consumption happens only
through a trusted server path), so a user cannot fabricate freezes.

#### Scenario: Owner reads only their own ledger
- **WHEN** a signed-in user reads the freeze ledger
- **THEN** only rows whose user id equals the requester are returned, and rows of other users are never returned

#### Scenario: Consumption is idempotent per gap day
- **WHEN** a freeze is consumed for a given user, kind, and UTC day, and the same gap is processed again on a later read
- **THEN** no additional consumption is recorded for that day and the remaining-freeze count is unchanged

#### Scenario: Budgets are independent per kind
- **WHEN** a user consumes a freeze for the `quiz` kind
- **THEN** the remaining allowance for the `prediction` kind is unaffected, and vice versa

### Requirement: Weekly freeze allowance

The system SHALL grant each user a small, fixed freeze allowance per streak kind
per week, where the week is the Monday-anchored UTC week (Monday 00:00:00 UTC to
the following Monday 00:00:00 UTC, half-open) already used by the prediction
streak. The allowance MUST refill at the start of each such week — a new week
restores the full allowance regardless of how many freezes were spent the prior
week — and the remaining allowance for a kind MUST equal the granted amount for
the current week minus the freezes consumed within that same week. Unused
freezes MUST NOT carry over into the next week.

#### Scenario: Full allowance at the start of a fresh week
- **WHEN** a new Monday-anchored UTC week begins and the user has consumed no freezes yet this week
- **THEN** the remaining allowance for each kind equals the fixed weekly amount

#### Scenario: Spending reduces the remaining allowance within the week
- **WHEN** a user consumes one freeze for a kind during the current week
- **THEN** the remaining allowance for that kind this week is the weekly amount minus one

#### Scenario: Unused freezes do not carry over
- **WHEN** a week ends with unused freezes and the next week begins
- **THEN** the remaining allowance resets to the full weekly amount and the prior week's unused freezes are not added

### Requirement: Freeze-aware streak computation

The system SHALL extend the pure streak functions `computeStreak` and
`computePredictionStreak` to accept the set of UTC day-keys for which the user
holds a consumed freeze, and to treat such a forgiven day — when it is a single
isolated gap inside an otherwise consecutive run — as not breaking the streak,
stepping over it while counting. The functions MUST remain pure: they MUST NOT
read the database, MUST NOT import any framework or Supabase module, and MUST
accept an injectable `now`. With no freeze days supplied (the default), the
functions MUST behave identically to their current behavior, preserving UTC-day
dedupe, timezone-offset normalization, the today-not-yet-done allowance, and the
prediction streak's Monday-anchored weekly window and 7-day cap.

#### Scenario: A single forgiven gap keeps the streak alive
- **WHEN** the user has activity on today and the day before yesterday but not yesterday, and yesterday is a consumed-freeze day
- **THEN** the streak counts through yesterday and returns 3

#### Scenario: A two-day gap still breaks the streak
- **WHEN** there is a two-day gap in the run and only one of the two missing days is a consumed-freeze day
- **THEN** the freeze does not bridge the two-day gap and the streak counts only the most recent unbroken run

#### Scenario: No freeze days reproduces current behavior
- **WHEN** `computeStreak` or `computePredictionStreak` is called with no consumed-freeze days
- **THEN** it returns exactly what it returns today for the same timestamps and `now`

#### Scenario: A freeze never invents activity
- **WHEN** a consumed-freeze day lies at the natural end of the run (no activity beyond it on either side)
- **THEN** it does not extend the count past where real activity exists

### Requirement: Automatic one-day gap consumption on read

The system SHALL, on the read paths that display a streak, detect a single
one-day gap that — ending on today's or yesterday's UTC day and bounded by
activity on the day before the gap — would extend the current streak if bridged,
and SHALL consume one freeze for that user and kind by recording that gap day in
the ledger, but only when the user has a remaining freeze for that kind in the
current week. Consumption MUST be best-effort: a failure to record a freeze MUST
NOT throw into the page render. The system MUST NOT consume a freeze when the
current unfrozen streak is 0, when no remaining freeze exists, or for an
anonymous user.

#### Scenario: Eligible one-day gap consumes a freeze and saves the streak
- **WHEN** a user with a remaining freeze for the kind has activity today and two days ago but missed yesterday, and views the streak
- **THEN** one freeze is recorded as consumed for yesterday and the displayed streak includes the bridged day

#### Scenario: No remaining freeze leaves the streak broken
- **WHEN** a user with no remaining freeze for the kind has the same one-day gap
- **THEN** no freeze is consumed and the displayed streak reflects only the unbroken run after the gap

#### Scenario: No freeze consumed when there is no streak to protect
- **WHEN** the user's current unfrozen streak is 0
- **THEN** no freeze is consumed regardless of remaining allowance

#### Scenario: Anonymous users never consume freezes
- **WHEN** an anonymous (signed-out) visitor loads a streak surface
- **THEN** no freeze ledger row is written and no freeze is consumed

### Requirement: Freeze state surfaced on My Picks and Quiz

The system SHALL display the user's remaining freeze allowance for the relevant
kind alongside the existing streak indicator on the `/my-picks` page (prediction
kind) and the `/quiz` page (quiz kind), and SHALL show a brief "streak saved"
affordance when a freeze was consumed in the current week to bridge the most
recent gap. The remaining-freeze indicator and any saved-streak copy SHALL be
localized for en, es, fr, and de, and the surfaces MUST continue to render
normally (no error or empty state) when the remaining allowance is zero or no
freeze has been used.

#### Scenario: My Picks shows remaining prediction freezes
- **WHEN** a signed-in user with a remaining prediction freeze views `/my-picks`
- **THEN** the header shows the remaining freeze count beside the prediction streak with a localized label

#### Scenario: Quiz shows remaining quiz freezes
- **WHEN** a signed-in user with a remaining quiz freeze views `/quiz`
- **THEN** the header shows the remaining freeze count beside the quiz streak with a localized label

#### Scenario: Saved-streak affordance after a freeze is used
- **WHEN** a freeze was consumed this week to bridge the user's most recent gap on the relevant surface
- **THEN** the surface shows a localized "streak saved" indication that a freeze protected the streak

#### Scenario: Zero remaining freezes renders cleanly
- **WHEN** a user has zero remaining freezes for the kind
- **THEN** the surface renders the streak and a zero remaining-freeze indicator without an error or empty state

### Requirement: Quiz reminder email reflects the protected streak

The system SHALL make the quiz reminder email report the freeze-protected
streak, by supplying each recipient's consumed-freeze days to the streak
computation used for the email, so the reminder never tells a user with a
still-alive (frozen) streak that their streak is gone. The email MUST NOT itself
consume a freeze — consumption is owned by the page read paths — and the streak
load MUST remain best-effort and never throw.

#### Scenario: Reminder shows the still-alive frozen streak
- **WHEN** a recipient's most recent gap was bridged by a consumed freeze
- **THEN** the quiz reminder email reports the streak as still alive rather than zero

#### Scenario: Email does not consume freezes
- **WHEN** the quiz reminder email computes a recipient's streak
- **THEN** it reads existing consumed-freeze days but records no new freeze consumption

### Requirement: No competitive-scoring impact

The system SHALL keep freezes confined to the engagement streak display and the
reminder copy. Freezes MUST NOT write to the `scores` table, MUST NOT alter
points, ranking, leaderboards (global, segmented, or group), or rank snapshots,
and MUST confer no competitive advantage.

#### Scenario: Consuming a freeze does not change scores or rank
- **WHEN** a user consumes a freeze to protect a streak
- **THEN** their points, leaderboard position, and rank snapshots are unchanged
