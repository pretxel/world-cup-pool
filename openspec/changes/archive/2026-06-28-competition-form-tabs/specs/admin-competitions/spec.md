## ADDED Requirements

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
