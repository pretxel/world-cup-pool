## ADDED Requirements

### Requirement: Announcement email presents the WinScore rebrand and new features

The announcement email SHALL render with the new **WinScore** brand identity (winscore.me
wordmark in place of the old "WC 26 POOL" mark) and SHALL communicate the newly shipped
features — at minimum multi-league support and crypto payments — as a scannable "what's new"
list, with a primary call-to-action linking to the WinScore site. The email MUST be produced
by a pure, dependency-free renderer that receives already-localized copy and returns a
subject, preheader, HTML body, and plain-text body, mirroring the existing transactional
email templates (email-safe table layout, inline styles, fixed hex colors — no oklch, CSS
variables, or external stylesheets).

#### Scenario: Rendered email carries the new brand and feature list

- **WHEN** the announcement renderer is called with the localized announcement copy
- **THEN** it returns a subject, preheader, HTML, and text where the HTML shows the WinScore
  wordmark, lists the new features (multi-league, crypto payments, and more), and includes a
  CTA linking to the WinScore site
- **AND** the plain-text body mirrors the same heading, feature list, and CTA URL

#### Scenario: Copy is fully localized

- **WHEN** the announcement copy is built for a supported locale (`en`, `es`)
- **THEN** the subject, preheader, heading, feature list, and CTA render from that locale's
  messages with no hard-coded user-facing English in the renderer

### Requirement: Announcement broadcasts to every eligible player honoring opt-out

The broadcast SHALL send the announcement to **every player**, resolving each recipient's
address through the service-role admin client, and SHALL skip any player who has opted out of
the reused announcement preference category. A missing or malformed preference MUST read as
opted-in, so partial preference data never silently drops a recipient. Players with no
sendable email address MUST be skipped and counted, never treated as a failure.

#### Scenario: Opted-out player is skipped

- **WHEN** the broadcast runs and a player has explicitly opted out of the announcement
  preference category
- **THEN** that player receives no email and is counted under `skipped`

#### Scenario: Player with no address is skipped

- **WHEN** a player has no resolvable or sendable email address
- **THEN** that player is skipped and counted, and the run continues for the rest

#### Scenario: Missing preference defaults to opted-in

- **WHEN** a player has no stored preference for the announcement category
- **THEN** the player is treated as opted-in and receives the announcement

### Requirement: Delivery is at-most-once via a send ledger

The broadcast SHALL record each successful send in a dedicated `announcement_email_log`
ledger keyed by user id, and SHALL exclude any player already present in the ledger on
subsequent runs, giving at-most-once delivery per player. A ledger row MUST be written only
after the email provider accepts the batch, so a failed or partial run leaves the remaining
players pending for the next run rather than losing or duplicating a send. The ledger table
MUST be service-role-only (row-level security enabled, no client policies), matching the
winners-email ledger posture.

#### Scenario: Re-running does not double-send

- **WHEN** the broadcast is triggered a second time after a prior successful run
- **THEN** players already in `announcement_email_log` are excluded and receive no second
  email

#### Scenario: Failed batch leaves recipients pending

- **WHEN** the email provider rejects a batch during a run
- **THEN** no ledger rows are written for that batch and those players remain pending for the
  next run

#### Scenario: Ledger is not client-accessible

- **WHEN** a signed-in non-admin or anonymous user attempts to read or write
  `announcement_email_log` through a normal client
- **THEN** row-level security denies the access (no policies grant it)

### Requirement: Broadcast is admin-triggered and safe when unconfigured

The broadcast SHALL run only when invoked manually by an admin from the operations control
room — never from a cron schedule — and SHALL no-op cleanly (sending nothing, writing no
ledger rows) when the email provider API key is unset. When the production email sender is
misconfigured, the run MUST surface a warning flag in its summary without changing the
resolved sender. The run summary MUST report recipient, emailed, failed, and skipped counts.

#### Scenario: No provider key is a clean no-op

- **WHEN** the broadcast runs with the Resend API key unset
- **THEN** it sends nothing, writes no ledger rows, and returns a zeroed summary

#### Scenario: Run reports its counts

- **WHEN** the broadcast completes
- **THEN** its summary reports how many recipients were eligible, emailed, failed, and skipped
