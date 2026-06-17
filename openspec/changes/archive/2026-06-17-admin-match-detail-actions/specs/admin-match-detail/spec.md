## ADDED Requirements

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

## MODIFIED Requirements

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
