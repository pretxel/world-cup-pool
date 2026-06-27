# score-rules-announcement-email Specification

## Purpose

Defines an admin-triggered, idempotent broadcast email that announces the current stage-weighted scoring rules to all opted-in players. It is fired on demand from the operations control room, sends each eligible player at most once via a dedicated send-once ledger, respects email opt-out and the production-sender guard, and renders a per-phase points table derived from the shared scoring constants so the email can never drift from the actual scorer.

## Requirements

### Requirement: Admin can send the scoring-rules announcement on demand

The system SHALL let an admin trigger, from the operations control room, a broadcast email that announces the current scoring rules to players. The trigger MUST assert admin authorization, reuse the shared run instrumentation (recording one `operation_runs` row with `trigger = "manual"`), and surface the run summary (emailed / failed / skipped counts) inline on completion. A non-admin MUST NOT be able to invoke it.

#### Scenario: Admin sends the announcement

- **WHEN** an admin presses "Run now" on the scoring-rules announcement job and authorization passes
- **THEN** the dispatch runs, a `manual` `operation_runs` row is recorded, and the resulting summary (or error) is shown inline

#### Scenario: Non-admin is rejected

- **WHEN** a non-admin attempts to invoke the announcement action
- **THEN** the admin assertion rejects it, no email is sent, and no run is recorded

### Requirement: Announcement is sent at most once per player

The system SHALL deliver the scoring-rules announcement to each eligible player at most once across all runs, using a dedicated send-once ledger keyed by user. Re-triggering the job MUST NOT re-email a player who has already received it. A ledger row MUST be written only after the corresponding send is accepted, so a failed send is retried on a later run rather than skipped.

#### Scenario: Re-pressing Run now does not re-send

- **WHEN** an admin triggers the announcement a second time after a successful run
- **THEN** players already recorded in the ledger are not emailed again, and only never-sent eligible players (if any) receive it

#### Scenario: Failed send remains pending

- **WHEN** a batch fails to send
- **THEN** no ledger rows are written for that batch and those players remain eligible on the next run

### Requirement: Recipients are opted-in players and opt-out is respected

The system SHALL send the announcement only to players who have not opted out of the applicable email preference. A missing or malformed preference SHALL be treated as opted-in. Players without a sendable email address SHALL be skipped and counted, never failing the run.

#### Scenario: Opted-out player excluded

- **WHEN** a player has opted out of the applicable email preference
- **THEN** they are not included in the announcement recipients

#### Scenario: Unsendable address skipped

- **WHEN** a recipient has no resolvable or valid email address
- **THEN** they are skipped and counted in the summary, and the run continues for the rest

### Requirement: Announcement content reflects the current scoring rules

The announcement body SHALL present the scoring on offer per phase (each stage with its points for the accuracy tiers), derived from the shared scoring multiplier and base-point constants — the same source as the landing-page explainer — so the email cannot drift from the actual scorer. Stage names SHALL be localized for the active competition format.

#### Scenario: Per-phase points match the scorer

- **WHEN** the announcement is rendered
- **THEN** each phase's displayed points equal the base accuracy points multiplied by that stage's factor from the shared constants

#### Scenario: Reflects updated multipliers

- **WHEN** the stage multipliers change and the announcement is sent afterward
- **THEN** the email shows the new per-phase points without a separate content edit

### Requirement: Dispatch is sender-guarded and no-ops cleanly

The dispatch SHALL warn and reflect a sender-misconfigured flag in its summary when the production email sender is misconfigured, and SHALL no-op (sending nothing, returning zero counts) when the email provider key is unset or there are no pending recipients, without throwing.

#### Scenario: Provider key unset

- **WHEN** the email provider API key is not configured
- **THEN** the dispatch sends nothing and returns zero counts without error

#### Scenario: No pending recipients

- **WHEN** every eligible player has already been sent the announcement
- **THEN** the dispatch sends nothing and returns zero counts
