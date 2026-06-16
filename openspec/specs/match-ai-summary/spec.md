# match-ai-summary

## Purpose

Rules governing AI-generated match recaps: a dedicated `match_summaries` model, generation gated to matches that have reached `final`, the OpenRouter-backed generation path (env-gated, English locale), isolation from result-sync score writes, and how a stored summary surfaces to viewers via the per-match live API and the match-detail view.

## Requirements

### Requirement: AI match summaries are stored in a dedicated model

The system SHALL persist one AI-generated recap per match in a `match_summaries` table keyed to `matches(id)` with `on delete cascade` and a unique constraint on `match_id` (at most one summary per match). Each row SHALL carry the recap `content` text, the `provider` (e.g. `openrouter`) and `model` id used to generate it, optional token-usage fields, a `locale`, and a `generated_at` timestamp. The table SHALL allow public `select` and SHALL restrict writes to the service role used by the sync.

#### Scenario: Summary persisted for a match
- **WHEN** a summary is generated for a match
- **THEN** a `match_summaries` row is written with its `content`, `provider`, `model`, and `generated_at`
- **AND** it is linked to the match via `match_id`

#### Scenario: At most one summary per match
- **WHEN** a summary already exists for a match and generation is attempted again
- **THEN** no duplicate row is created (the unique `match_id` constraint holds)

#### Scenario: Public can read, only sync can write
- **WHEN** an unauthenticated client reads a match's summary
- **THEN** the read succeeds
- **AND** a client write to `match_summaries` is rejected by row-level security

### Requirement: Summary is generated after a match reaches final

The system SHALL generate a match summary only after a match transitions to
`status = 'final'`, using that match's `match_events` timeline ordered by
`sequence` plus the final score and team names as the generation input.
Generation SHALL NOT run for matches whose status is `scheduled`, `live`, or
`cancelled`. The system SHALL require that the match has at least one
`match_event`: if a `final` match has no ingested events, generation SHALL be
skipped — no language-model request is made and no `match_summaries` row is
written. This precondition applies to every generation path (the cron pass and
the manual admin trigger alike).

#### Scenario: Final match triggers generation
- **WHEN** a match transitions to `final`, has at least one `match_event`, and has no existing summary
- **THEN** a summary is generated from its ordered `match_events` and final score
- **AND** the result is written to `match_summaries`

#### Scenario: Non-final match is not summarized
- **WHEN** a match's status is `scheduled`, `live`, or `cancelled`
- **THEN** no summary is generated for it

#### Scenario: Final match with no events is not summarized
- **WHEN** the generation step runs for a `final` match that has zero `match_events`
- **THEN** no language-model request is made and no `match_summaries` row is written
- **AND** the cron pass counts the match as skipped rather than generated

#### Scenario: Already-summarized match is skipped
- **WHEN** the generation step runs for a `final` match that already has a `match_summaries` row
- **THEN** the existing summary is left unchanged and no LLM request is made

### Requirement: Summaries are generated via OpenRouter and gated by env

The system SHALL call the OpenRouter chat-completions API to produce the recap, authenticated with an `OPENROUTER_API_KEY` env var and using a configurable model id (with a sensible default). If `OPENROUTER_API_KEY` is missing, the generation step SHALL short-circuit without making an HTTP request and without throwing. The prompt SHALL instruct the model to write a concise, factual recap **in English** grounded only in the provided events and score. The stored row's `locale` SHALL be `'en'`.

#### Scenario: Missing key short-circuits
- **WHEN** the generation step runs and `OPENROUTER_API_KEY` is unset
- **THEN** no OpenRouter request is made
- **AND** no error is thrown and no `match_summaries` row is written

#### Scenario: Successful generation calls OpenRouter
- **WHEN** the generation step runs for an eligible match with `OPENROUTER_API_KEY` set
- **THEN** an OpenRouter chat-completion request is made carrying the match events and score
- **AND** the returned text is stored as the summary `content` with the `model` recorded

### Requirement: Generation is isolated from score writes and recorded

The system SHALL run summary generation in isolation from the result-sync score/status writes, such that a failure or timeout in generation never blocks or rolls back a match's score, status update, or score computation. Each generation pass SHALL be tracked as an operation run via the existing `recordRun` mechanism so it surfaces in operations monitoring.

#### Scenario: Generation failure does not block sync
- **WHEN** summary generation throws or times out during a sync run
- **THEN** the match's score and `final` status are still persisted
- **AND** the failure is recorded rather than propagated to the cron response

#### Scenario: Generation pass is recorded
- **WHEN** a summary generation pass runs
- **THEN** an operation run is recorded with its outcome (success, partial, or error)

### Requirement: Stored summary surfaces to viewers

The system SHALL expose a match's stored summary to viewers. The per-match live API (`GET /api/matches/[matchId]/live`) response SHALL include an optional `summary` field that is present once a summary exists and absent otherwise. The match-detail view SHALL render the summary when present as read-only content (the recap body is English; surrounding section labels remain localized) and SHALL omit the section entirely when no summary exists.

#### Scenario: Live payload includes summary when present
- **WHEN** a client requests the live API for a match that has a stored summary
- **THEN** the response includes a `summary` field with the recap content

#### Scenario: Live payload omits summary when absent
- **WHEN** a client requests the live API for a match with no summary
- **THEN** the `summary` field is absent (not an error)

#### Scenario: Match detail renders summary when present
- **WHEN** a viewer opens the detail view of a match that has a summary
- **THEN** the recap is displayed as read-only content
- **AND** when no summary exists the section is not rendered
