# knockout-team-autofill

## ADDED Requirements

### Requirement: Confirm league-seeded Quarterfinal participants

For a knockout fixture whose placeholder references `Seed N`, the confirmation action SHALL resolve that side from the confirmed seeding of the stage named by `seedsFromStage`. It SHALL not write any seed-derived side until every fixture in that league stage is final.

#### Scenario: Confirmed regular season fills Quarterfinals
- **WHEN** every Liga MX regular-season fixture is final and the admin runs confirmation
- **THEN** Quarterfinal fixtures are filled as seeds 1 v 8, 2 v 7, 3 v 6, and 4 v 5

#### Scenario: Incomplete regular season keeps placeholders
- **WHEN** at least one Liga MX regular-season fixture is not final
- **THEN** no seed-derived playoff participant is written

### Requirement: Confirm aggregate winners

The confirmation action SHALL resolve a `Winner Tie <tie_key>` placeholder only after both legs of that tie are final. It SHALL use aggregate score; for Quarterfinal and Semifinal ties that are level, it SHALL resolve the participant with the better regular-season seed from the configured seed source. If a tie has an explicit official winner, that outcome SHALL take precedence.

#### Scenario: Aggregate winner fills a downstream fixture
- **WHEN** both legs of a Quarterfinal tie are final and one team leads on aggregate
- **THEN** confirmation fills that tie winner into its resolved downstream fixture

#### Scenario: Aggregate tie advances the higher seed
- **WHEN** both legs are final and their aggregate score is level
- **AND** the tie is a Quarterfinal or Semifinal
- **THEN** confirmation resolves the team with the better regular-season seed

#### Scenario: Incomplete aggregate tie remains unresolved
- **WHEN** one leg of a two-legged tie is not final
- **THEN** confirmation leaves its downstream placeholder untouched

### Requirement: Semifinal participants are reseeded after Quarterfinals

For a stage declaring `reseedFromStage`, confirmation SHALL wait for every source-stage tie to resolve, order all winners by their regular-season seed, and fill the reseeded slots. It SHALL not write a partial semifinal field from only some completed Quarterfinals.

#### Scenario: Quarterfinal upset is reseeded correctly
- **WHEN** all Quarterfinal ties resolve and their winners are regular-season seeds 1, 3, 6, and 7
- **THEN** the Semifinals pair seeds 1 v 7 and 3 v 6

#### Scenario: Pending Quarterfinal prevents semifinal confirmation
- **WHEN** any Quarterfinal tie remains unresolved
- **THEN** confirmation keeps every reseeded Semifinal slot as a placeholder
