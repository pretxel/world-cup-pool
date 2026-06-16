## MODIFIED Requirements

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
