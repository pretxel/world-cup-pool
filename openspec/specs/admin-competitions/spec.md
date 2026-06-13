# admin-competitions Specification

## Purpose
TBD - created by archiving change support-multiple-competitions. Update Purpose after archive.
## Requirements
### Requirement: Competitions list and create

The admin SHALL provide a `/admin/competitions` surface that lists all competitions (read via the service-role admin client so non-active competitions are visible) showing slug, name/short_name, season, an ACTIVE badge (public `is_active`) and a MANAGED badge (admin context), and SHALL provide a create form that inserts a new competition with `is_active` forced to false.

#### Scenario: List shows non-active competitions

- **WHEN** an admin opens `/admin/competitions` while a second, non-active competition exists
- **THEN** both the active and the non-active competition appear in the list, each with correct ACTIVE/MANAGED badges

#### Scenario: Create yields an inactive competition

- **WHEN** an admin submits the create form with a valid slug and format_config
- **THEN** a new `competitions` row is inserted with `is_active = false`
- **AND** the admin is taken to its edit page

#### Scenario: Duplicate slug rejected

- **WHEN** an admin submits the create form with a slug that already exists
- **THEN** the action surfaces a readable "slug already used" error and no row is inserted

### Requirement: Structured format/providers/branding editor

The competition create/edit form SHALL author `format_config` (stages with key/kind/order/per-locale labels/icon/hasGroupCode, and a groups block with enabled/pattern/count), `providers`, and `branding` through structured inputs validated client- and server-side by a shared Zod schema that mirrors the DB shape-validation trigger, with the DB trigger remaining the final authority. A raw-JSON escape hatch MAY be offered but SHALL be validated by the same schema.

#### Scenario: Malformed format rejected before write

- **WHEN** an admin submits a `format_config` with duplicate stage keys or an empty stages array
- **THEN** the server action rejects it via the shared Zod schema before any database write and shows a field-level error

#### Scenario: League-only format omits groups

- **WHEN** an admin sets the groups block to disabled and adds a single `kind: 'league'` stage with `hasGroupCode: false`
- **THEN** the form validates and saves a `format_config` with `groups.enabled = false`

#### Scenario: Order is derived from position

- **WHEN** an admin reorders the stages list via the up/down controls
- **THEN** each stage's `order` is set from its list position without the admin typing order numbers

### Requirement: Set active competition is confirmation-gated and the only public mutation

The admin SHALL change the public active competition only through a confirmation dialog that names the outgoing and incoming competition and lists consequences, invoking the existing `set_active_competition` RPC; the create/edit forms SHALL NOT write `is_active`, and there SHALL be no bare deactivate control.

#### Scenario: Activation requires confirmation

- **WHEN** an admin clicks Set active on a non-active competition
- **THEN** a confirmation dialog naming the current and incoming active competition is shown
- **AND** the active flag flips only after explicit confirmation

#### Scenario: Activation revalidates public surfaces

- **WHEN** the admin confirms set-active
- **THEN** the `set_active_competition` RPC is called
- **AND** the root layout, `/matches`, and the `leaderboard` cache tag are revalidated

#### Scenario: Zero-fixture activation warns

- **WHEN** an admin attempts to set active a competition that has no fixtures
- **THEN** the dialog surfaces a readiness warning that the admin must acknowledge before activating

### Requirement: Delete competition guardrails

The admin SHALL refuse to delete a competition that is currently active, is the World Cup 2026 seed (`slug = 'world-cup-2026'`), or has any matches, predictions, or friend groups, returning a readable error; only an empty, non-active, non-seed competition may be deleted, and the `slug` field SHALL become read-only once the competition has any fixtures.

#### Scenario: Delete blocked with dependents

- **WHEN** an admin attempts to delete a competition that has fixtures
- **THEN** the deletion is refused with an error stating the fixture (and predictions/groups) counts and no rows are deleted

#### Scenario: Delete blocked for active

- **WHEN** an admin attempts to delete the currently active competition
- **THEN** the deletion is refused with a message to switch active away first

#### Scenario: Slug locked after fixtures

- **WHEN** an admin edits a competition that already has fixtures
- **THEN** the slug input is rendered read-only

