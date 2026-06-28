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

### Requirement: Competition editor is presented as a tabbed form

The competition create/edit form SHALL present its sections — Identity, Dates & opening, Format, Providers, and Branding — as a set of tabs (one section visible at a time) rather than a single vertical stack, using the shared tabs primitive. The tab strip SHALL be keyboard-accessible (roving focus, correct `tab`/`tabpanel` roles, visible focus indicator) and SHALL remain usable on narrow (mobile) admin viewports by wrapping or scrolling rather than overflowing.

#### Scenario: Sections are reachable as tabs
- **WHEN** an admin opens `/admin/competitions/new` or `/admin/competitions/[id]`
- **THEN** the five sections are presented as selectable tabs and selecting a tab shows that section's fields
- **AND** only the selected section's content is visible at a time

#### Scenario: Tab strip is keyboard accessible
- **WHEN** an admin focuses the tab strip and uses the keyboard
- **THEN** focus moves between tabs with arrow keys and the active tab has a visible focus indicator

#### Scenario: Tab strip fits a narrow viewport
- **WHEN** the editor is viewed at a mobile width
- **THEN** the tab strip wraps or scrolls and no tab is clipped off-screen

### Requirement: Tabbing preserves single-submit integrity

Reorganizing the editor into tabs SHALL NOT change the submitted payload: a single submit SHALL persist every section's values, regardless of which tab is active when the form is submitted. All tab panels SHALL remain mounted so that native inputs and the hidden JSON inputs that the Providers and Branding sections assemble from their own local state are present in the submitted form data at all times. Switching tabs SHALL NOT reset any section's entered values.

#### Scenario: Submit from a non-default tab saves everything
- **WHEN** an admin edits Identity and Dates, switches to the Branding tab, and submits from there
- **THEN** the server action receives slug, name, dates, `format_config`, `providers`, and `branding` exactly as if the form had been submitted from the first tab
- **AND** no section's value is missing or reset

#### Scenario: Switching tabs preserves entered values
- **WHEN** an admin enters values in the Providers tab and switches to another tab and back
- **THEN** the Providers values are still present and unchanged

### Requirement: Submit and validation feedback are accessible from every tab

The submit control, the live format-validation gate, and the action status/error banner SHALL be rendered outside the tab panels so they are visible and operable no matter which tab is active. When live `format_config` validation fails (the condition that disables submit), the Format tab SHALL carry a discoverable invalid indicator so the gating problem can be found without opening that tab.

#### Scenario: Submit works from any tab
- **WHEN** an admin is on any tab
- **THEN** the submit button and any action status/error banner are visible and the form can be submitted without first returning to a specific tab

#### Scenario: Invalid format is discoverable
- **WHEN** the live `format_config` validation fails and the submit button is disabled
- **THEN** the Format tab shows an invalid indicator
- **AND** the indicator clears once the format becomes valid

