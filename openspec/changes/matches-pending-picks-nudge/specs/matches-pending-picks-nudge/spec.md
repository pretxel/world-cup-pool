## ADDED Requirements

### Requirement: In-app pending-picks nudge on the matches list

The `/matches` list SHALL display a dismissible in-app banner near the top of the page for the **currently authenticated** user when they have at least one upcoming fixture still needing a pick (`needsPickCount > 0`). The banner MUST state how many upcoming matches still need a pick, using localized, count-pluralized copy. The banner SHALL reuse the already-computed `needsPickCount` and MUST NOT issue any additional per-user query. For anonymous (signed-out) visitors the banner SHALL NOT render.

#### Scenario: Signed-in user with pending picks sees the nudge

- **WHEN** an authenticated user with `needsPickCount` greater than zero opens `/matches`
- **THEN** a banner appears near the top of the page stating how many upcoming matches still need a pick
- **AND** the stated number matches the count shown by the existing needs-pick toggle

#### Scenario: No nudge when nothing is pending

- **WHEN** an authenticated user whose `needsPickCount` is zero opens `/matches`
- **THEN** no pending-picks banner is rendered

#### Scenario: Anonymous visitor sees no nudge

- **WHEN** a signed-out visitor opens `/matches`
- **THEN** no pending-picks banner is rendered
- **AND** no additional per-user prediction query is issued

### Requirement: Nudge CTA filters to the pending fixtures

The banner SHALL provide a call-to-action that activates the existing needs-pick filter by setting the `?picks=needed` query parameter, the same state the `NeedsPickToggle` writes. The banner SHALL be suppressed when the `?picks=needed` filter is already active, so the nudge is not shown while the list is already narrowed to pending fixtures.

#### Scenario: Activating the CTA filters the list

- **WHEN** the signed-in user activates the banner's CTA
- **THEN** the matches list is filtered to fixtures that still need a pick via the `?picks=needed` query parameter

#### Scenario: Nudge hidden while the filter is active

- **WHEN** an authenticated user opens `/matches` with the `?picks=needed` filter already active
- **THEN** no pending-picks banner is rendered

### Requirement: Nudge is dismissible and accessible

The banner SHALL be dismissible; once the user dismisses it, it MUST stay hidden for the remainder of that session. The dismiss control MUST expose a localized accessible label, and all banner text (count copy, CTA, dismiss label) MUST be sourced from localized `matches.*` messages available in all four locales (de, en, es, fr).

#### Scenario: Dismissing hides the nudge

- **WHEN** the signed-in user dismisses the banner
- **THEN** the banner is removed from view
- **AND** it does not reappear for the remainder of the session

#### Scenario: Dismiss control is labeled

- **WHEN** the banner is rendered
- **THEN** its dismiss control exposes a localized accessible label to assistive technology
