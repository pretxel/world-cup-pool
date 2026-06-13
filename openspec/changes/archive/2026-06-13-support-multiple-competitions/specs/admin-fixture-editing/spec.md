## ADDED Requirements

### Requirement: Fixtures/results admin scope to the managed competition

The admin fixtures list and the fixture/result/delete actions SHALL scope to the MANAGED competition (the admin editing context) rather than to all matches or solely to the active competition. The matches list SHALL filter `.eq('competition_id', managedId)`. `saveFixture` SHALL stamp new fixtures with the managed `competition_id`, derive its stage options and `group_code` validation from the managed competition's `format_config`, hide the `group_code` input when the managed competition has no group stage, and reject any submitted `competition_id` that does not equal the server-derived managed id. `setMatchResult`, `forceRecompute`, and `deleteMatch` SHALL verify the target match belongs to the managed competition before mutating. In the single-seeded WC2026 case the managed competition equals the active competition, so behavior is unchanged.

#### Scenario: List scoped to managed

- **WHEN** an admin sets a non-active competition as managed and opens `/admin/matches`
- **THEN** only that competition's fixtures are listed
- **AND** the stage options come from its `format_config`

#### Scenario: New fixture stamped with managed competition

- **WHEN** an admin creates a fixture while managing a competition
- **THEN** the inserted row has `competition_id` equal to the managed competition's id

#### Scenario: Group input hidden for league-only formats

- **WHEN** the managed competition has `groups.enabled = false`
- **THEN** the `group_code` input is not rendered
- **AND** submitting a fixture stores `group_code` as NULL

#### Scenario: Cross-competition mutation rejected

- **WHEN** a stale form posts a `match_id` belonging to a competition other than the current managed one
- **THEN** the action mutates zero rows and returns a clear error rather than editing another competition

#### Scenario: Invalid stage rejected against managed format

- **WHEN** a fixture submission carries a stage not present in the managed competition's `format_config`
- **THEN** the server validation rejects it before the database write

### Requirement: Manual sync targets the managed competition

The admin `syncNow` action SHALL pass the managed competition id into `runSync({ competitionId })` so an admin can sync a non-active competition's providers, while the cron route SHALL continue to call `runSync()` with no competition argument and thereby sync only the public active competition. Revalidation after an admin mutation SHALL skip public paths and the leaderboard tag when the managed competition is not active, and perform the full public revalidation when managed equals active.

#### Scenario: Manual sync uses managed scope

- **WHEN** an admin triggers Sync results now while managing a non-active competition
- **THEN** `runSync` is invoked with that competition's id
- **AND** only its matches/providers are used

#### Scenario: Cron stays on active

- **WHEN** the cron route triggers a sync with no competition specified
- **THEN** the sync defaults to the active competition

#### Scenario: Non-active mutation skips public revalidation

- **WHEN** an admin saves a result on a managed competition that is not the active one
- **THEN** public paths and the leaderboard tag are not revalidated
- **AND** only the admin matches path is revalidated
