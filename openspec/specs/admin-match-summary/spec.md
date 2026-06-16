# admin-match-summary

## Purpose

Rules governing an admin-only, on-demand match summarization control in the match-management view. An authenticated admin can trigger AI recap generation for a single `final` match they manage; the action is gated on the match having `match_event` data, persists the recap when one is produced, and surfaces its outcome inline. All admin-facing labels and outcome messages are localized for the supported locales (en/es/fr) while the recap body itself remains English.

## Requirements

### Requirement: Admin can summarize a managed match on demand

The system SHALL provide an admin-only control, in the match-management view, that
triggers AI recap generation for a single `final` match the admin manages. The
control SHALL be available only to authenticated admins and only for a match that
belongs to the admin's managed competition. Activating the control SHALL run the
recap generator for that match and SHALL persist the recap when one is produced.
The control SHALL NOT be offered for a match whose status is not `final`.

#### Scenario: Admin triggers summarization for a final match with events
- **WHEN** an admin activates the Summarize control for a `final` match that has `match_events` and no existing recap
- **THEN** a recap is generated for that match and written to `match_summaries`
- **AND** the admin sees a success outcome for that match

#### Scenario: Control is not offered for non-final matches
- **WHEN** a match's status is `scheduled`, `live`, or `cancelled`
- **THEN** the Summarize control is not rendered for that match

#### Scenario: Non-admin cannot summarize
- **WHEN** a request to summarize a match is made without admin authorization
- **THEN** the action is rejected and no recap is generated

#### Scenario: Match outside the managed competition is rejected
- **WHEN** an admin attempts to summarize a match that does not belong to their managed competition
- **THEN** the action is rejected and no recap is generated

### Requirement: Summarization requires match-event data

The system SHALL validate that a match has at least one `match_event` before
generating a recap from the admin control. When the match has no events, the
action SHALL NOT call the recap generator's language-model step and SHALL NOT
write a `match_summaries` row, and the admin SHALL be told no events are available
to summarize. The management view SHOULD reflect this precondition by not offering
an actionable Summarize control for a `final` match that has no events.

#### Scenario: Final match with no events is not summarized
- **WHEN** an admin activates the Summarize control for a `final` match that has zero `match_events`
- **THEN** no recap is generated and no `match_summaries` row is written
- **AND** the admin sees a "no events to summarize" outcome

#### Scenario: Management view signals the missing-events state
- **WHEN** the management view renders a `final` match that has no events and no recap
- **THEN** an actionable Summarize control is not presented for that match
- **AND** the view indicates that there is no event data to summarize yet

### Requirement: Summarization outcome is surfaced inline

The system SHALL report the outcome of an admin summarization attempt inline in
the management view for the affected match, distinguishing at least: recap
generated, recap already existed, no events to summarize, match not final,
generator disabled (no API key configured), and generation error. When a match
already has a recap, the management view SHALL indicate that a recap is ready
rather than offering to generate another, and SHALL NOT create a duplicate recap.
All admin-facing labels and outcome messages SHALL be localized for the supported
locales (en/es/fr); the recap body itself remains English.

#### Scenario: Already-summarized match shows a ready indicator
- **WHEN** the management view renders a `final` match that already has a recap
- **THEN** it indicates a recap is ready
- **AND** it does not offer to generate a duplicate recap

#### Scenario: Disabled generator is reported, not failed
- **WHEN** an admin activates the Summarize control while no OpenRouter API key is configured
- **THEN** no recap is written
- **AND** the admin sees a "generator disabled" outcome rather than an error page

#### Scenario: Generation error is reported inline
- **WHEN** recap generation throws during an admin summarization attempt
- **THEN** the management view shows an error outcome for that match
- **AND** the admin page itself still renders (the action does not produce a server error page)

#### Scenario: Outcome messages are localized
- **WHEN** an admin uses the management view in a supported locale
- **THEN** the Summarize control label and every outcome message are shown in that locale
