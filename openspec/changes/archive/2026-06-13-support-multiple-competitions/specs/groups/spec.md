## ADDED Requirements

### Requirement: Friend groups belong to a competition

Each friend group SHALL carry a `competition_id`. New groups SHALL be stamped with the active competition at creation, and "my groups" listings SHALL filter to the active competition.

#### Scenario: New group scoped to active competition

- **WHEN** a user creates a friend group
- **THEN** the group's `competition_id` equals the active competition's id

#### Scenario: My groups filtered by active competition

- **WHEN** a user views their groups while a given competition is active
- **THEN** only groups belonging to that competition are listed

### Requirement: Join codes use the competition prefix

`generate_join_code()` SHALL use the competition's join-code prefix (remaining `WC-` for World Cup 2026). Existing join codes SHALL continue to work after the change.

#### Scenario: World Cup join code prefix preserved

- **WHEN** a group is created while `world-cup-2026` is active
- **THEN** its join code uses the `WC-` prefix

#### Scenario: Existing codes remain valid

- **WHEN** a user enters a previously issued join code after the migration
- **THEN** the code still resolves to its group
