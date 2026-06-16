## MODIFIED Requirements

### Requirement: AI match summaries are stored in a dedicated model

The system SHALL persist AI-generated recaps in a `match_summaries` table keyed to
`matches(id)` with `on delete cascade`. A match MAY have multiple recap **versions**;
at most one version per match SHALL be marked active (`is_active`), enforced by a
partial unique index on `match_id` where `is_active`. Each row SHALL carry the recap
`content` text, the `provider` (e.g. `openrouter`) and `model` id used to generate it,
optional token-usage fields, a `locale`, a `generated_at` timestamp, a `style_key`
identifying the recap style, and an optional `style_instruction` recording the exact
style guidance applied. The table SHALL restrict writes to the service role used by
generation and admin actions, and SHALL allow public `select` only of active versions.

#### Scenario: Summary persisted for a match
- **WHEN** a recap version is generated for a match
- **THEN** a `match_summaries` row is written with its `content`, `provider`, `model`, `style_key`, and `generated_at`
- **AND** it is linked to the match via `match_id`

#### Scenario: Multiple versions, at most one active
- **WHEN** a match has more than one recap version
- **THEN** at most one of them is marked active (the partial unique active index holds)

#### Scenario: Public can read only the active version, only service role can write
- **WHEN** an unauthenticated client reads a match's recap
- **THEN** the read returns the active version and never a draft version
- **AND** a client write to `match_summaries` is rejected by row-level security

### Requirement: Summary is generated after a match reaches final

The system SHALL generate a match summary only after a match transitions to
`status = 'final'`, using that match's `match_events` timeline ordered by
`sequence` plus the final score and team names as the generation input.
Generation SHALL NOT run for matches whose status is `scheduled`, `live`, or
`cancelled`. The system SHALL require that the match has at least one
`match_event`: if a `final` match has no ingested events, generation SHALL be
skipped — no language-model request is made and no `match_summaries` row is
written. This precondition applies to every generation path (the cron pass, the
manual admin trigger, and admin regeneration alike). The automatic path (cron and
the management-list quick action) SHALL store its recap as the active version and
SHALL skip when the match already has any recap version; admin regeneration SHALL
instead add a new non-active draft version (defined in the `admin-match-detail`
capability).

#### Scenario: Final match triggers generation
- **WHEN** a match transitions to `final`, has at least one `match_event`, and has no existing recap version
- **THEN** a summary is generated from its ordered `match_events` and final score
- **AND** the result is written to `match_summaries` as the active version

#### Scenario: Non-final match is not summarized
- **WHEN** a match's status is `scheduled`, `live`, or `cancelled`
- **THEN** no summary is generated for it

#### Scenario: Final match with no events is not summarized
- **WHEN** the generation step runs for a `final` match that has zero `match_events`
- **THEN** no language-model request is made and no `match_summaries` row is written
- **AND** the cron pass counts the match as skipped rather than generated

#### Scenario: Already-summarized match is skipped by the automatic path
- **WHEN** the automatic generation step runs for a `final` match that already has a recap version
- **THEN** the existing versions are left unchanged and no LLM request is made

### Requirement: Summaries are generated via OpenRouter and gated by env

The system SHALL call the OpenRouter chat-completions API to produce the recap,
authenticated with an `OPENROUTER_API_KEY` env var and using a configurable model id
(with a sensible default). If `OPENROUTER_API_KEY` is missing, the generation step
SHALL short-circuit without making an HTTP request and without throwing. The prompt
SHALL instruct the model to write a concise, factual recap **in English** grounded
only in the provided events and score. Generation MAY accept an optional style
instruction (a preset or admin-supplied free text); when present it SHALL be applied
to the prompt without overriding the grounding constraint that the model use only the
provided score and events, and the applied style SHALL be recorded on the stored row
via `style_key` and `style_instruction`. The stored row's `locale` SHALL be `'en'`.

#### Scenario: Missing key short-circuits
- **WHEN** the generation step runs and `OPENROUTER_API_KEY` is unset
- **THEN** no OpenRouter request is made
- **AND** no error is thrown and no `match_summaries` row is written

#### Scenario: Successful generation calls OpenRouter
- **WHEN** the generation step runs for an eligible match with `OPENROUTER_API_KEY` set
- **THEN** an OpenRouter chat-completion request is made carrying the match events and score
- **AND** the returned text is stored as the recap `content` with the `model` recorded

#### Scenario: Style instruction shapes the prompt and is recorded
- **WHEN** generation runs with a style instruction supplied
- **THEN** the instruction is applied to the prompt while the grounding constraint still holds
- **AND** the stored version records the style via `style_key` and `style_instruction`

### Requirement: Stored summary surfaces to viewers

The system SHALL expose a match's **active** recap version to viewers. The per-match
live API (`GET /api/matches/[matchId]/live`) response SHALL include an optional
`summary` field that is present once an active version exists and absent otherwise.
The match-detail view SHALL render the active version when present as read-only content
(the recap body is English; surrounding section labels remain localized) and SHALL omit
the section entirely when no active version exists. Draft (non-active) versions SHALL
NOT be surfaced to viewers.

#### Scenario: Live payload includes the active summary when present
- **WHEN** a client requests the live API for a match that has an active recap version
- **THEN** the response includes a `summary` field with the active version's content

#### Scenario: Live payload omits summary when no active version
- **WHEN** a client requests the live API for a match with no active recap version
- **THEN** the `summary` field is absent (not an error)

#### Scenario: Match detail renders the active version when present
- **WHEN** a viewer opens the detail view of a match that has an active recap version
- **THEN** the active recap is displayed as read-only content
- **AND** when no active version exists the section is not rendered
