# recap-image-one-click Specification

## Purpose
TBD - created by archiving change recap-image-one-click. Update Purpose after archive.
## Requirements
### Requirement: One-click generate-and-render action

The admin match detail page SHALL provide a per-recap-version action that, in a single
operation, generates the version's `image_prompt` from its recap and then requests the
Leonardo render. The action SHALL be restricted to admins and SHALL validate that the
target version belongs to the match in scope, mirroring the existing recap actions.

#### Scenario: Admin generates the prompt and render in one click

- **WHEN** an admin triggers the combined action for a recap version
- **THEN** the system generates and stores the version's `image_prompt`, then requests
  a Leonardo render for that version, and reports the combined outcome

#### Scenario: Restricted to the owning match

- **WHEN** the action is invoked for a `summary_id` that does not belong to the posted
  match
- **THEN** no prompt generation or render is performed and an error outcome is reported

### Requirement: Combined outcome reporting

The combined action SHALL report a single outcome that distinguishes full success
(prompt generated and render requested), the partial case (prompt generated but render
skipped or failed), and failure (prompt could not be generated). A failure or skip in
either step SHALL NOT surface a server-error page; it SHALL be reported inline like the
other admin recap actions.

#### Scenario: Render skipped because the provider key is unset

- **WHEN** the combined action generates the prompt but the render is skipped because
  `LEONARDO_API_KEY` is unset
- **THEN** the outcome reports that the prompt was generated and the render was skipped
  (not a generic error)

#### Scenario: Prompt generation fails

- **WHEN** image-prompt generation fails (e.g. `OPENROUTER_API_KEY` unset or a provider
  error)
- **THEN** the render is not attempted and the outcome reports the prompt-step result

### Requirement: Reuses existing generation without new side effects

The combined action SHALL reuse the existing `generateMatchImagePrompt` and
`requestMatchImageRender` behaviors and SHALL introduce no new external calls, schema,
storage, or environment requirements. It SHALL remain dormant exactly as those steps do
when their provider keys are unset, and the existing granular admin controls SHALL
remain available.

#### Scenario: Fully dormant when both keys are unset

- **WHEN** the combined action runs while both `OPENROUTER_API_KEY` and
  `LEONARDO_API_KEY` are unset
- **THEN** no external request or write occurs and the outcome reports that nothing was
  generated or rendered

