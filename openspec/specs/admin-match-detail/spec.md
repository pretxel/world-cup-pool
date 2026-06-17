# admin-match-detail

## Purpose

Rules governing an admin-only fixture detail page at `/admin/matches/[matchId]` that lets an authenticated admin inspect a managed match (read-only fixture information and its event timeline) and manage its AI recap **versions**. From this page an admin can list every stored recap version with the active one marked, regenerate a new styled draft version, publish a version by making it active, and delete a non-active draft. Every action's outcome is surfaced inline, and all admin-facing labels, style names, and outcome messages are localized for the supported locales (en/es/fr) while the recap body itself remains English.

## Requirements

### Requirement: Admin can open a fixture detail page from the management list

The system SHALL provide an admin-only fixture detail page at
`/admin/matches/[matchId]` and SHALL link to it from each match row in the
management list. The page SHALL be available only to authenticated admins and
only for a match that belongs to the admin's managed competition; a request for a
match outside the managed competition SHALL NOT render the detail page. The page
SHALL render read-only fixture information (teams, score, status, stage, kickoff,
venue) and the match's event timeline.

#### Scenario: Open detail from the list
- **WHEN** an admin activates the "Open" control for a match row in the management list
- **THEN** the admin navigates to that match's detail page at `/admin/matches/[matchId]`
- **AND** the page shows the fixture information and its event timeline

#### Scenario: Match outside the managed competition is not shown
- **WHEN** an admin requests the detail page for a match that does not belong to their managed competition
- **THEN** the detail page is not rendered for that match

#### Scenario: Non-admin cannot open the detail page
- **WHEN** a request for a fixture detail page is made without admin authorization
- **THEN** the request is rejected and no fixture detail is rendered

### Requirement: Detail page lists recap versions with an active indicator

The detail page SHALL list every stored recap version for the match, showing each
version's `content`, its style, the model used, and when it was generated. Exactly
one version per match MAY be marked active; the page SHALL clearly indicate which
version is active (the one shown to viewers) and SHALL distinguish non-active
versions as drafts. When the match has no recap versions, the page SHALL show an
empty state rather than a version list.

#### Scenario: Versions are listed with the active one marked
- **WHEN** an admin opens the detail page for a match that has more than one recap version
- **THEN** every version is listed with its content, style, model, and generated-at
- **AND** the active version is visibly marked as the one shown to viewers

#### Scenario: No versions shows an empty state
- **WHEN** an admin opens the detail page for a match that has no recap versions
- **THEN** an empty state is shown instead of a version list

### Requirement: Admin can regenerate a styled recap version

The detail page SHALL let an admin generate a new recap version by choosing a
preset style (at least: neutral, dramatic, tactical, concise) or supplying a
free-text custom style instruction. The chosen style SHALL be applied to the
generation prompt, and the result SHALL be stored as a new **draft** version
(not active) so it does not change what viewers currently see. Regeneration SHALL
create a new version even when the match already has one or more recaps (it SHALL
NOT be blocked by an existing recap). The control SHALL require match-event data:
when the match has no events, the system SHALL NOT call the language model or
store a version, and the admin SHALL be told no events are available to summarize.

#### Scenario: Regenerate with a preset style creates a draft
- **WHEN** an admin regenerates a recap for a `final` match with events, choosing the "dramatic" preset
- **THEN** a new recap version is generated with the dramatic style and stored as a draft (not active)
- **AND** the previously active version remains the one shown to viewers

#### Scenario: Regenerate with a custom instruction
- **WHEN** an admin regenerates a recap supplying a free-text custom style instruction
- **THEN** the instruction is applied to the generation and the new version records the custom style

#### Scenario: Regeneration is allowed when a recap already exists
- **WHEN** an admin regenerates a recap for a match that already has one or more versions
- **THEN** a new version is created rather than skipped as already-existing

#### Scenario: Regeneration requires events
- **WHEN** an admin attempts to regenerate a recap for a match with zero `match_events`
- **THEN** no language-model request is made and no version is stored
- **AND** the admin sees a "no events to summarize" outcome

### Requirement: Admin can publish a version by making it active

The detail page SHALL let an admin mark a chosen recap version as active. Marking
a version active SHALL make it the single active version for that match (any
previously active version for the same match SHALL become non-active), and the
newly active version SHALL become the one surfaced to viewers. The system SHALL
maintain at most one active version per match.

#### Scenario: Activating a draft publishes it
- **WHEN** an admin marks a draft version active for a match
- **THEN** that version becomes the match's active version
- **AND** any previously active version for the same match is no longer active

#### Scenario: At most one active version per match
- **WHEN** a version is made active for a match
- **THEN** the match has exactly one active version

### Requirement: Admin can delete a non-active draft version

The detail page SHALL let an admin delete a recap version that is not active. The
system SHALL refuse to delete the active version, so a match never silently loses
its published recap; to remove the active version the admin must first make a
different version active.

#### Scenario: Deleting a draft removes it
- **WHEN** an admin deletes a non-active recap version
- **THEN** that version is removed and the match's other versions are unchanged

#### Scenario: Deleting the active version is refused
- **WHEN** an admin attempts to delete the active version
- **THEN** the version is not deleted
- **AND** the admin is told to activate another version first

### Requirement: Detail-page outcomes are surfaced inline and localized

The system SHALL report the outcome of each detail-page action inline on the detail
page, distinguishing at least: fixture saved, fixture-edit validation error, result
saved, scores recomputed, result emails resent (with the emailed/failed/skipped
summary), fixture deleted, version generated, no events to summarize, match not
final, generator disabled (no API key configured), generation error, version
activated, version deleted, and delete-refused-because-active. The generation
control SHALL be unavailable (with an explanation) when the generator is disabled.
All admin-facing labels, style names, and outcome messages SHALL be localized for
the supported locales (en/es/fr/de); the recap body itself remains English.

#### Scenario: Action outcomes are reported inline
- **WHEN** an admin saves a fixture edit, saves a result, recomputes, or resends emails on the detail page
- **THEN** the corresponding outcome (fixture saved, result saved, scores recomputed, or the resend summary) is shown inline
- **AND** the page itself still renders (the action does not produce a server-error page)

#### Scenario: Generation error is reported inline
- **WHEN** recap generation throws during a regenerate attempt
- **THEN** the detail page shows an error outcome
- **AND** the page itself still renders (the action does not produce a server-error page)

#### Scenario: Disabled generator is reported, not failed
- **WHEN** an admin attempts to regenerate while no OpenRouter API key is configured
- **THEN** no version is written
- **AND** the admin sees a "generator disabled" outcome rather than an error page

#### Scenario: Outcome labels are localized
- **WHEN** an admin uses the detail page in a supported locale
- **THEN** the control labels, style names, and every outcome message are shown in that locale

### Requirement: Admin can edit fixture fields from the detail page

The detail page at `/admin/matches/[matchId]` SHALL provide a form to edit the match's `stage`, `group_code`, `home_team`, `away_team`, `kickoff_at`, and `venue`, submitting to the existing `saveFixture` action with the match's `id`. The form SHALL derive its stage options and `group_code` validation from the managed competition's format, hide the `group_code` input when the managed competition has no group stage, and apply the same field validation as fixture creation (non-empty teams, home ≠ away, valid stage). On success the page SHALL show the updated fixture information and an inline success outcome.

#### Scenario: Edit fixture from the detail page
- **WHEN** an admin changes the home team, away team, kickoff, and venue on the detail page and saves
- **THEN** the match is updated via `saveFixture`
- **AND** the detail page re-renders the updated fixture information with a success outcome

#### Scenario: Group input hidden for league-only formats
- **WHEN** the managed competition has no group stage
- **THEN** the detail edit form does not render the `group_code` input

#### Scenario: Edit validation surfaced inline
- **WHEN** an admin submits the edit form with the home team equal to the away team
- **THEN** the update is rejected and the detail page shows an error outcome without losing the page

### Requirement: Admin can enter a match result from the detail page

The detail page SHALL provide a result-entry form for `home_score`, `away_score`, and `status` that submits to the existing `setMatchResult` action scoped to the managed competition. Saving a result SHALL update the match and trigger `compute_match_scores`, then re-render the detail page with the new score, status, and an inline success outcome.

#### Scenario: Enter a final score
- **WHEN** an admin sets `home_score`, `away_score`, and `status = final` on the detail page and saves
- **THEN** `setMatchResult` updates the match and recomputes scores
- **AND** the detail page shows the new score and status with a success outcome

#### Scenario: Result entry scoped to managed competition
- **WHEN** the result form posts a `match_id` outside the managed competition
- **THEN** the action rejects via `assertMatchInManaged` and no row is updated

### Requirement: Admin can run per-match maintenance from the detail page

The detail page SHALL provide per-match maintenance controls: **Force recompute scores** (invoking `forceRecompute`), **Resend result emails** (shown only for `final` matches, invoking `resendResultEmails`), and **Delete fixture** (confirm-gated and destructive, invoking `deleteMatch`). Each control SHALL be `assertAdmin()`-gated and scoped to the managed competition. After a successful delete, since the detail page no longer exists, the admin SHALL be redirected to the `/admin/matches` list with an inline outcome there. Force recompute and resend SHALL report their outcome inline on the detail page.

#### Scenario: Force recompute from the detail page
- **WHEN** an admin activates Force recompute scores on the detail page
- **THEN** `forceRecompute` runs `compute_match_scores` for the match
- **AND** an inline outcome is shown on the detail page

#### Scenario: Delete redirects to the list
- **WHEN** an admin confirms Delete fixture on the detail page
- **THEN** the match is deleted via `deleteMatch`
- **AND** the admin is redirected to `/admin/matches` rather than to a missing detail page

#### Scenario: Resend control gated by status
- **WHEN** an admin opens the detail page for a non-`final` match
- **THEN** the Resend result emails control is not offered
