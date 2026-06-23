# stage-weighted-scoring Specification

## Purpose
Prediction points scale by the match's stage so later knockout rounds are worth more than group-stage matches, keeping the leaderboard meaningful deep into the tournament. The base accuracy points (5 exact / 3 winner+GD / 1 winner / 0 miss) are multiplied by a per-stage factor inside the single scoring source of truth, the TS replica mirrors it for tests, and the landing page explains the per-phase points on offer from the shared constants.

## Requirements

### Requirement: Points scale by match stage

Prediction points SHALL be the base accuracy points (5 exact, 3 winner+GD, 1 winner, 0 miss) multiplied by a per-stage factor: group ×1, Round of 32 ×2, Round of 16 ×4, Quarter-final ×6, Semi-final ×8, Final ×10, Third-place play-off ×4. An unknown/unmapped stage SHALL use ×1. The `hit_type` classification SHALL NOT change.

#### Scenario: Exact pick in the final
- **WHEN** a user's prediction exactly matches a `final` match result
- **THEN** they receive 50 points (5 × 10) with hit_type `exact`

#### Scenario: Winner+GD in a Round-of-32 match
- **WHEN** a user's prediction matches the winner and goal difference of an `r32` match
- **THEN** they receive 6 points (3 × 2) with hit_type `winner_gd`

#### Scenario: Group match unchanged
- **WHEN** a user's prediction scores on a `group` match
- **THEN** the points equal the base (×1) and hit_type is unchanged

#### Scenario: Miss scores zero at any stage
- **WHEN** a prediction misses the winner
- **THEN** points are 0 regardless of stage

### Requirement: Weighting lives in the scoring source of truth

The stage multiplier SHALL be applied inside `public.compute_match_scores`, which remains the single writer of `public.scores`; leaderboards aggregate the resulting weighted points without change.

#### Scenario: Recompute applies the multiplier
- **WHEN** `compute_match_scores` runs for a final knockout match
- **THEN** each inserted score row's points equal base × the stage factor

### Requirement: Landing page explains per-phase scoring

The landing page SHALL include a section explaining the scoring per phase — for each stage (group through final and the third-place play-off) showing the points on offer (the base accuracy points scaled by that stage's multiplier). The displayed values SHALL be derived from the shared multiplier/base constants (not hardcoded), so the explainer always matches the actual scoring, and SHALL be localized.

#### Scenario: Scoring section shown on the landing
- **WHEN** a visitor opens the landing page
- **THEN** a section lists each phase with its points on offer (e.g. exact in the final = 50), derived from the shared multipliers

#### Scenario: Stays in sync with the scorer
- **WHEN** the stage multipliers change
- **THEN** the landing explainer reflects the new values without a separate edit (it reads the shared constant)

#### Scenario: Localized
- **WHEN** the landing is viewed under a supported locale (en, es, fr, de)
- **THEN** the scoring section's labels render in that locale

### Requirement: TS replica matches the SQL

`lib/scoring.ts` SHALL expose the same per-stage multipliers and apply them in `scorePrediction`, defaulting to ×1 when no stage is given, so it stays a faithful, unit-tested replica of `compute_match_scores`.

#### Scenario: Replica parity
- **WHEN** `scorePrediction` is given a result and a stage
- **THEN** its points equal the base × that stage's multiplier, matching the SQL
