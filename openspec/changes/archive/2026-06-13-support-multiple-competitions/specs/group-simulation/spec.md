## ADDED Requirements

### Requirement: Group standings render only for competitions with a group stage

Group standings and simulation SHALL render only when the active competition has a group stage (`groups.enabled = true`), and SHALL key the group-stage query off the competition's group-stage key instead of the literal `'group'`.

#### Scenario: World Cup shows group standings

- **WHEN** the active competition is `world-cup-2026`
- **THEN** group standings render using the competition's group-stage key

#### Scenario: League-only competition hides group standings

- **WHEN** the active competition has `groups.enabled = false`
- **THEN** no group standings or simulation UI is rendered
