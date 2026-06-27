# admin-matches-tabs Specification

## Purpose

Organizes the admin matches page (`/admin/matches`) into a tabbed workspace so its distinct concerns — managing fixtures, syncing results / confirming knockout teams, and revealing knockout rounds — are separated into focused, linkable views instead of a single long scroll. The active tab is owned by the URL, conditional on available data (the Reveal tab only appears when knockout rounds exist), and action redirects land on the tab that surfaces their result.

## Requirements

### Requirement: Tabbed admin matches workspace

The admin matches page (`/admin/matches`) SHALL present its sections inside a tab strip with three tabs: **Fixtures** (the new-fixture form and the full fixtures list), **Sync** (the result-sync panel and the confirm-knockout-teams action with their result panels), and **Reveal** (the knockout round reveal toggles). Exactly one tab's content SHALL be visible at a time. The page header and the always-mounted live region SHALL remain visible above the tab strip on every tab.

#### Scenario: Default tab on first load

- **WHEN** an admin opens `/admin/matches` with no `tab` query param and no action-result params
- **THEN** the Fixtures tab is active and shows the new-fixture form and the fixtures list

#### Scenario: Each tab shows only its sections

- **WHEN** the admin activates the Sync tab
- **THEN** the result-sync panel and the confirm-knockout-teams action are shown
- **AND** the new-fixture form, the fixtures list, and the reveal toggles are not shown

#### Scenario: Section behavior is unchanged

- **WHEN** the admin uses any control inside a tab (create fixture, run sync, confirm knockout teams, toggle a reveal, open a fixture detail)
- **THEN** the control behaves exactly as it did before tabs were introduced

### Requirement: URL-owned tab selection

The active tab SHALL be encoded in the URL as `?tab=fixtures|sync|reveal`, read server-side, so the view is linkable and survives reload. Switching tabs SHALL update the `tab` query param without resetting other query params and without a scroll jump.

#### Scenario: Switching tabs updates the URL

- **WHEN** the admin clicks the Sync tab
- **THEN** the URL gains `tab=sync`
- **AND** reloading the page keeps the Sync tab active

#### Scenario: Deep link opens the requested tab

- **WHEN** the admin navigates directly to `/admin/matches?tab=sync`
- **THEN** the Sync tab is active

#### Scenario: Unknown tab value falls back

- **WHEN** the admin navigates to `/admin/matches?tab=bogus`
- **THEN** the Fixtures tab is active

### Requirement: Reveal tab is conditional on knockout rounds

The Reveal tab SHALL be present only when the managed competition has at least one knockout round, mirroring the existing conditional render of the reveal section. When no knockout rounds exist, the Reveal tab SHALL NOT be shown and a `tab=reveal` param SHALL fall back to the Fixtures tab.

#### Scenario: Knockout rounds present

- **WHEN** the managed competition has one or more knockout rounds
- **THEN** the Reveal tab is shown alongside Fixtures and Sync

#### Scenario: No knockout rounds

- **WHEN** the managed competition has no knockout rounds
- **THEN** the Reveal tab is not shown
- **AND** navigating to `/admin/matches?tab=reveal` activates the Fixtures tab

### Requirement: Action redirects land on the relevant tab

After a server action redirects back to the matches page, the page SHALL display the tab whose section contains that action's result, so the admin sees the outcome without manually switching tabs.

#### Scenario: Sync result shows on the Sync tab

- **WHEN** the admin runs "Sync now" and the action redirects back with sync-summary params
- **THEN** the Sync tab is active
- **AND** the sync result panel is visible

#### Scenario: Confirm-knockout result shows on the Sync tab

- **WHEN** the admin runs "Confirm knockout teams" and the action redirects back with `confirmUpdated`
- **THEN** the Sync tab is active
- **AND** the confirm result panel is visible

#### Scenario: Fixture delete returns to the Fixtures tab

- **WHEN** a fixture is deleted from the detail page and the redirect returns to `/admin/matches` with `deleteResult=deleted`
- **THEN** the Fixtures tab is active
- **AND** the "fixture deleted" confirmation is visible

### Requirement: Accessible, responsive tab strip

The tab strip SHALL use accessible tab semantics (tablist/tab/tabpanel roles and keyboard navigation) and SHALL remain usable on small screens with adequately sized touch targets.

#### Scenario: Keyboard navigation between tabs

- **WHEN** a keyboard user focuses the tab strip and presses the arrow keys
- **THEN** focus moves between tabs and the active tab's panel updates

#### Scenario: Announcements fire regardless of active tab

- **WHEN** an action completes and its outcome is written to the live region
- **THEN** the announcement is made even if the corresponding result panel is on a non-active tab, because the live region is mounted above the tabs
