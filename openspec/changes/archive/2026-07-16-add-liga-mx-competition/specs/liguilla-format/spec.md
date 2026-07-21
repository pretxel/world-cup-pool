# liguilla-format

## ADDED Requirements

### Requirement: Top eight qualify directly for the Liguilla

The eight highest regular-season seeds SHALL qualify directly for two-legged Quarterfinals. The pairings SHALL be 1 v 8, 2 v 7, 3 v 6, and 4 v 5; no Play-In or Reclasificación fixtures SHALL be created for Apertura 2026.

#### Scenario: Direct Quarterfinal pairings
- **WHEN** regular-season seeding is confirmed
- **THEN** the four Quarterfinal ties pair the top eight seeds directly

### Requirement: Two-legged aggregate ties

Quarterfinals, Semifinals, and the Final SHALL each be a two-legged tie. Each leg SHALL be a distinct `matches` row linked by the same `tie_key` with `leg` 1 or 2, and each SHALL accept predictions and be scored as an ordinary match. The tie winner SHALL be the team with the higher aggregate score.

#### Scenario: Each leg is independently scored
- **WHEN** a user predicts both legs of a Quarterfinal tie
- **THEN** each prediction is scored against its own final score under normal rules

#### Scenario: Aggregate decides the winner
- **WHEN** both legs are final
- **THEN** the team with the higher combined score resolves as tie winner

### Requirement: Higher seed advances a Quarterfinal or Semifinal aggregate tie

When a Quarterfinal or Semifinal aggregate tie is level, the team with the better regular-season seed SHALL advance. Away goals SHALL NOT affect the result.

#### Scenario: Aggregate level advances the higher seed
- **WHEN** a Quarterfinal or Semifinal tie finishes level on aggregate
- **THEN** the participant with the better regular-season seed resolves as winner

### Requirement: A tied Final records its official extra-time or penalty winner

When a Final is level on aggregate, the competition SHALL resolve the title through the official extra-time and penalty outcome, not by regular-season seed. The second-leg match SHALL record the winning team and whether the decision was in extra time or penalties.

#### Scenario: Penalty-decided Final retains its winner
- **WHEN** the Final is level on aggregate after extra time and one team wins the penalty shootout
- **THEN** the second leg records that team as the tie winner with decision `penalties`

### Requirement: Semifinals are reseeded by regular-season position

Once all Quarterfinal ties resolve, their winners SHALL be ranked by regular-season seed. The Semifinals SHALL pair the highest remaining seed with the lowest, and the other two winners with each other. The better seed in every two-legged tie SHALL host the second leg.

#### Scenario: Resolved Quarterfinal winners are reseeded
- **WHEN** Quarterfinal winners have regular-season seeds 1, 3, 6, and 7
- **THEN** the Semifinal pairings are 1 v 7 and 3 v 6
