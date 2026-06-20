## MODIFIED Requirements

### Requirement: Best-third slots resolved by official allocation when groups complete

The system SHALL resolve each `3rd Group X/Y/Z/…` slot using the competition's official best-third allocation. Once **every group has at least one result** (so each group's current third-placed team is real), the system SHALL project the slots **provisionally**: rank the current third-placed teams across all groups, take the current best eight, apply the allocation for that set, and mark each filled slot **provisional**. Once **all groups have completed every match**, the same resolution SHALL be marked **confirmed** (the qualifying set and order are final). Before every group has a result, the slot SHALL render its candidate-group placeholder.

#### Scenario: Candidate placeholder before any ranking is meaningful
- **WHEN** at least one group has no result yet
- **THEN** every `3rd Group …` slot renders its candidate-group placeholder, unresolved

#### Scenario: Provisional projection mid-stage
- **WHEN** every group has at least one result but not all groups have completed every match
- **THEN** each `3rd Group …` slot shows the third-placed team assigned by the official allocation for the current best-eight set, marked provisional

#### Scenario: Confirmed after all groups complete
- **WHEN** all 12 groups have played every match
- **THEN** each `3rd Group …` slot shows the allocated third-placed team marked confirmed

#### Scenario: Reshuffles as standings change
- **WHEN** results change which groups hold the current best-eight thirds
- **THEN** the provisional third-slot projections update accordingly
