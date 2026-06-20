## ADDED Requirements

### Requirement: Replyable, non-no-reply sender

Transactional email SHALL be sent from a non-`no-reply` address and SHALL include a `Reply-To` header pointing to a monitored, replyable address. The From display name MAY remain the brand name.

#### Scenario: From is not no-reply
- **WHEN** the app sends any transactional email
- **THEN** the From address is not a `no-reply@…` address

#### Scenario: Reply-To present
- **WHEN** the app sends any transactional email (single send or batch)
- **THEN** the message carries a `Reply-To` set to the configured reply address

### Requirement: Configurable reply address with safe default

The reply address SHALL be read from `EMAIL_REPLY_TO`, defaulting to the From address when unset, so a Reply-To is always present.

#### Scenario: Default when unset
- **WHEN** `EMAIL_REPLY_TO` is not set
- **THEN** the Reply-To equals the From address (still non-no-reply)

#### Scenario: Override honored
- **WHEN** `EMAIL_REPLY_TO` is set
- **THEN** every transactional send uses it as the Reply-To

### Requirement: Reply-To applied across all senders

Every transactional sender — result, prediction-reminder, quiz-reminder, welcome, group-invite (single sends) and results-digest, recap-digest, comeback (batch sends) — SHALL include the Reply-To on its Resend payload.

#### Scenario: Batch sends include Reply-To
- **WHEN** a digest/comeback batch is sent
- **THEN** each message in the batch carries the Reply-To

### Requirement: DMARC record published

The domain SHALL publish a valid DMARC TXT record at `_dmarc.<sending-domain>` with at least `v=DMARC1; p=none`, satisfying Gmail/Yahoo/Microsoft sender requirements.

#### Scenario: DMARC resolves
- **WHEN** a receiver queries `_dmarc.edselserrano.com`
- **THEN** a TXT record beginning `v=DMARC1; p=none` is returned

#### Scenario: Monitoring without deliverability risk
- **WHEN** a message fails SPF/DKIM alignment under `p=none`
- **THEN** it is not quarantined or rejected by DMARC policy (monitor only), and a report may be sent to the configured `rua`
