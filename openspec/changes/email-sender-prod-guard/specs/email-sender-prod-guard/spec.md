## ADDED Requirements

### Requirement: Detect production email-sender misconfiguration

The system SHALL provide a pure guard that inspects the resolved email configuration and reports whether the production email sender is misconfigured. The guard MUST treat the sender as misconfigured when the resolved `emailFrom` address is the Resend sandbox default (`onboarding@resend.dev`) and/or when `RESEND_API_KEY` is unset. The guard MUST classify a misconfiguration as warning-worthy only when the runtime is production (`NODE_ENV === "production"`), and MUST NOT throw, mutate any environment value, or change the resolved sender.

#### Scenario: Production with sandbox sender default
- **WHEN** the guard runs with `NODE_ENV === "production"` and `emailFrom` still resolves to an address at `onboarding@resend.dev`
- **THEN** the guard reports the sender as misconfigured (sandbox sender) and warning-worthy

#### Scenario: Production with missing API key
- **WHEN** the guard runs with `NODE_ENV === "production"` and `RESEND_API_KEY` is unset
- **THEN** the guard reports the sender as misconfigured (missing API key) and warning-worthy

#### Scenario: Production with a verified-domain sender and key
- **WHEN** the guard runs with `NODE_ENV === "production"`, a non-sandbox `emailFrom`, and `RESEND_API_KEY` set
- **THEN** the guard reports the sender as correctly configured and not warning-worthy

#### Scenario: Non-production environment is not flagged
- **WHEN** the guard runs outside production (e.g. development) even with the sandbox sender and no key
- **THEN** the guard does not report a production warning, leaving non-prod behavior unchanged

### Requirement: Warn when production email sender is misconfigured

The email dispatchers SHALL emit a single clear warning (via `console.warn`) when the guard detects a production misconfiguration, replacing the prior silent no-op log so the problem is visible in cron and server logs. Dispatchers MUST still degrade gracefully — when `RESEND_API_KEY` is unset they continue to no-op and return a zero summary; they MUST NOT throw or fail the cron.

#### Scenario: Missing API key in production warns and still no-ops
- **WHEN** a dispatcher runs in production with `RESEND_API_KEY` unset
- **THEN** it logs a clear warning identifying the missing key
- **AND** it sends no email and returns a zero count summary without throwing

#### Scenario: Sandbox sender in production warns but still sends
- **WHEN** a dispatcher runs in production with a valid `RESEND_API_KEY` but the sandbox `emailFrom` default
- **THEN** it logs a clear warning identifying the sandbox sender
- **AND** it proceeds to send using the existing behavior

#### Scenario: Correct production config produces no warning
- **WHEN** a dispatcher runs in production with a verified-domain `emailFrom` and `RESEND_API_KEY` set
- **THEN** no sender-misconfiguration warning is logged

### Requirement: Surface misconfiguration in the dispatch summary

The shared dispatch summary SHALL carry a flag indicating that the production email sender was detected as misconfigured during the run, so the signal propagates through the run recorder and the operations record / cron logs. Adding the flag MUST NOT change the meaning of the existing `emailed`, `failed`, and `skipped` counts.

#### Scenario: Flag set on misconfigured run
- **WHEN** a dispatch runs in production while the sender is misconfigured (sandbox default and/or missing key)
- **THEN** the returned summary includes a flag marking the sender as misconfigured

#### Scenario: Flag clear on healthy run
- **WHEN** a dispatch runs with a correctly configured production sender
- **THEN** the returned summary does not mark the sender as misconfigured

#### Scenario: Existing counts unchanged
- **WHEN** the misconfiguration flag is present on a summary
- **THEN** the `emailed`, `failed`, and `skipped` counts retain their prior meaning and are consumed unchanged by the run recorder

### Requirement: Document required production email configuration

The project SHALL document the required production email configuration — `EMAIL_FROM` set to a Resend verified-domain sender and `RESEND_API_KEY` set — and the meaning of the misconfiguration warning, so an operator can recognize and resolve the degraded state.

#### Scenario: Operator can act on the warning
- **WHEN** an operator encounters the sender-misconfiguration warning in logs or the operations record
- **THEN** the documentation explains which environment variables to set and what the correct production values look like
