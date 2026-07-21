# stage-weighted-scoring

## ADDED Requirements

### Requirement: Competition format can override a stage multiplier

`format_config.stages[].pointMultiplier`, when present, SHALL be the multiplier for matches in that stage of that competition. `public.compute_match_scores` and `lib/scoring.ts` SHALL resolve the same value. If the field is absent, the existing legacy stage mapping and its unknown-stage `×1` fallback SHALL remain in effect.

#### Scenario: Liga MX playoff match uses its configured multiplier
- **WHEN** `compute_match_scores` scores a final Liga MX `qf` leg with `pointMultiplier = 6`
- **THEN** an exact prediction receives 30 points

#### Scenario: Existing World Cup multiplier remains unchanged
- **WHEN** a World Cup final is scored and its format config has no `pointMultiplier`
- **THEN** an exact prediction receives 50 points through the existing final-stage multiplier

### Requirement: Scoring explainer uses the active competition format

The public scoring explainer SHALL derive each displayed stage multiplier from the active competition's resolved format, including any configured `pointMultiplier`, with the same fallback used by scoring.

#### Scenario: Liga MX explainer reflects its stages
- **WHEN** Liga MX is the active competition
- **THEN** the scoring explainer lists its regular season and Liguilla stages with their configured points on offer
