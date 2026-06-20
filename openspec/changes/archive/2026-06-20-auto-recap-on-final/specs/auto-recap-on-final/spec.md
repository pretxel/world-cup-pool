## ADDED Requirements

### Requirement: Automatic image prompt after a summary exists

The system SHALL, off the existing sync cron, generate an image prompt for any active recap summary of a final match that has summary content but no `image_prompt` yet — with no admin action. This step SHALL be gated on the OpenRouter key and SHALL no-op when it is unset.

#### Scenario: Prompt generated for a freshly summarized final
- **WHEN** a match is final with an active summary that has content and an empty `image_prompt`
- **THEN** the cron generates and stores an `image_prompt` for that summary automatically

#### Scenario: No key, no work
- **WHEN** `OPENROUTER_API_KEY` is unset
- **THEN** the prompt pass performs no generation and does not error

#### Scenario: Idempotent
- **WHEN** an active summary already has a non-empty `image_prompt`
- **THEN** the cron does not regenerate or overwrite it

### Requirement: Automatic Leonardo render after a prompt exists

The system SHALL, off the existing sync cron, request a Leonardo image render for any active summary that has a non-empty `image_prompt` and no existing `match_summary_images` render row — with no admin action. The render SHALL complete asynchronously through the existing callback-image webhook. This step SHALL be gated on the Leonardo key and SHALL no-op when it is unset.

#### Scenario: Render requested once a prompt is ready
- **WHEN** an active summary has a non-empty `image_prompt` and no `match_summary_images` row
- **THEN** the cron requests a Leonardo render for it and a pending render row is created

#### Scenario: Completion via webhook
- **WHEN** Leonardo finishes a requested render
- **THEN** the existing callback-image path finalizes it to `status = 'complete'` (unchanged)

#### Scenario: No duplicate render requests
- **WHEN** a summary already has a `match_summary_images` row (pending, complete, or failed)
- **THEN** the cron does not request another render for it

#### Scenario: No key, no work
- **WHEN** `LEONARDO_API_KEY` is unset
- **THEN** the render pass performs no requests and does not error

### Requirement: Isolated from the sync run

The automatic prompt and render passes SHALL run after the summary pass within the sync cron, and a failure in either SHALL be logged and SHALL NOT abort the sync (score/status writes have already committed) nor the other recap steps. Their counts SHALL be included in the run summary.

#### Scenario: A render failure does not break the sync
- **WHEN** the render pass throws or a single render request fails
- **THEN** the cron still returns its summary and the match's score/status writes are unaffected
- **AND** the run summary reports the prompt/render counts

### Requirement: One cron run chains the pipeline end to end

Within a single sync run, the passes SHALL execute in order summary → prompt → render, so a match that just finalized can progress through all three stages; any stage not reached SHALL be picked up by a subsequent run (the passes are convergent, not one-shot).

#### Scenario: Same-run progression
- **WHEN** a match finalizes during a sync run and the keys are configured
- **THEN** the run generates its summary, then its image prompt, then requests its render
