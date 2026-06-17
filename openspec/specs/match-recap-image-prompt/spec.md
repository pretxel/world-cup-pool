# match-recap-image-prompt Specification

## Purpose
TBD - created by archiving change match-recap-image-prompt. Update Purpose after archive.
## Requirements
### Requirement: Image prompt storage

The system SHALL store an image-generation prompt per recap version in a nullable
`image_prompt` text column on `match_summaries`. The column SHALL default to `null`
(no prompt yet), and a stored prompt SHALL belong to the same row whose `content` it
was derived from. Public read access SHALL follow the existing recap policy (the
`image_prompt` of the active version is publicly readable; draft versions are not).

#### Scenario: Recap without an image prompt

- **WHEN** a recap version is created but no image prompt has been generated
- **THEN** its `image_prompt` is `null` and the recap remains fully usable

#### Scenario: Image prompt persisted on the same row

- **WHEN** an image prompt is generated from a recap version's `content`
- **THEN** the prompt is written to that same row's `image_prompt` column without
  altering `content`, `style_key`, or `is_active`

### Requirement: Comic-strip template contract

The system SHALL build the image prompt from a fixed 90s-anime comic-strip template
whose **ART STYLE**, **CHARACTER DESIGN** (recurring protagonist "Kenji"), and
**TECHNICAL SPECIFICATIONS** sections are emitted verbatim. Only the **PANEL LAYOUT
& SCENE SEQUENCE** SHALL be generated from the recap, producing exactly four panels,
each with a `Visual` description and a `Narration Box` line that reflect that match's
story. The generated content SHALL be grounded in the recap `content` and the
provided match context (teams, score, stage) and SHALL NOT introduce match facts
absent from that source.

#### Scenario: Fixed sections preserved

- **WHEN** an image prompt is generated for any recap
- **THEN** the output contains the verbatim ART STYLE, CHARACTER DESIGN, and
  TECHNICAL SPECIFICATIONS sections unchanged from the template

#### Scenario: Panels reflect the match

- **WHEN** the recap describes a 2-1 win with two named goals
- **THEN** the generated four-panel sequence narrates that result and those moments
  and references the actual teams, without inventing goals or players not in the recap

### Requirement: Automatic image-prompt generation after recap

The system SHALL, after an active recap version is generated and its `content` is
stored in the result-sync (auto) flow, build and store that version's `image_prompt`.
This step SHALL be isolated so that a failure to generate or store the image prompt
never blocks recap storage, score writes, or the surrounding sync.

#### Scenario: Active recap gains an image prompt

- **WHEN** the auto flow generates and stores a new active recap for a final match
- **THEN** the system generates the image prompt from that recap's `content` and
  stores it on the same row

#### Scenario: Image-prompt failure is isolated

- **WHEN** the image-prompt generation call fails (e.g. provider error)
- **THEN** the recap `content`, score writes, and sync still succeed and the failure
  is logged rather than propagated

### Requirement: Admin-triggered image-prompt generation

The admin match detail page SHALL provide a per-recap-version action that generates
(or regenerates) the `image_prompt` for the selected version on demand, overwriting
any existing prompt for that version. The action SHALL be restricted to admins and
SHALL report success or failure to the operator.

#### Scenario: Admin generates a prompt for a version

- **WHEN** an admin triggers the "generate image prompt" action for a recap version
- **THEN** the system builds the prompt from that version's `content`, stores it in
  `image_prompt`, and the new prompt is shown in the admin UI

#### Scenario: Admin regenerates an existing prompt

- **WHEN** an admin triggers the action for a version that already has an
  `image_prompt`
- **THEN** the stored prompt is replaced with the newly generated one

### Requirement: Provider-key-dormant behavior

When `OPENROUTER_API_KEY` is unset, image-prompt generation SHALL be dormant: it
SHALL make no network or database write and SHALL report that it did nothing, exactly
as the recap generator does. A configured key that then fails SHALL surface the error
to the caller (admin path) or be logged without blocking (auto path).

#### Scenario: No key configured

- **WHEN** image-prompt generation runs while `OPENROUTER_API_KEY` is unset
- **THEN** no OpenRouter request or `image_prompt` write occurs and the caller is told
  generation was skipped

