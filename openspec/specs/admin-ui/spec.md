# admin-ui Specification

## Purpose
TBD - created by archiving change redesign-admin-ui. Update Purpose after archive.
## Requirements
### Requirement: Admin design language

The admin section SHALL present a cohesive "operator control room" treatment of the product's stadium theme. All admin screens MUST use the established theme tokens (Bricolage heading font, Manrope body, JetBrains mono, pitch-green primary, gold accent, oklch surfaces from `app/globals.css`) and the shared `components/ui/*` primitives, so the admin area reads as the same product as the public app. Ad-hoc bare `<select>`/`<input>` rows and unstyled `<li>` lists MUST be replaced with themed primitives.

#### Scenario: Consistent theme across admin screens

- **WHEN** an admin views any admin screen (dashboard, competitions, fixtures, quiz)
- **THEN** typography, color, spacing, and surface treatment are visually consistent and use the shared theme tokens and UI primitives
- **AND** no screen renders unstyled native form controls or plain bordered list rows

#### Scenario: Light and dark theme support

- **WHEN** the app theme is light or dark
- **THEN** every admin screen renders legibly with adequate contrast using the existing theme variables, with no hard-coded colors that break in either mode

### Requirement: Admin command bar and navigation

The admin shell SHALL provide a persistent command bar with clear navigation between Dashboard, Competitions, Fixtures, and Quiz, indicating the current section. The bar MUST remain usable on small screens (horizontal scroll or compact menu) and keep navigation reachable while scrolling.

#### Scenario: Current section is indicated

- **WHEN** an admin is on a given admin screen
- **THEN** the matching navigation item is visually marked as active
- **AND** all other top-level sections remain one click/tap away

#### Scenario: Navigation on mobile

- **WHEN** an admin views the shell on a narrow viewport
- **THEN** all navigation destinations remain reachable without overflow clipping content or actions

### Requirement: Managed-context safety

The shell SHALL make the active (public) competition and the currently managed (editing) competition unambiguous at all times, and SHALL visibly warn when they diverge so the admin does not edit the wrong competition. Switching the managed context MUST be available from the shell.

#### Scenario: Managed competition differs from active

- **WHEN** the managed competition is not the active (public) competition
- **THEN** the shell shows a prominent, distinguishable warning identifying both competitions

#### Scenario: Switching managed context

- **WHEN** an admin switches the managed competition from the shell
- **THEN** subsequent admin screens scope their data to the newly managed competition

### Requirement: Dashboard at a glance

The admin dashboard SHALL present operational status first: the live (public) competition and the managed competition with their key counts, plus primary entry points to each section. It MUST handle the empty case where no competition exists yet.

#### Scenario: Dashboard with a configured competition

- **WHEN** an admin opens the dashboard with at least one competition configured
- **THEN** the live and managed competitions are shown with at-a-glance status and quick links to Competitions, Fixtures, and Quiz

#### Scenario: Dashboard with no competition

- **WHEN** no competition exists
- **THEN** the dashboard shows a helpful empty state guiding the admin to create the first competition

### Requirement: Competitions presentation and form structure

The competitions list SHALL render as scannable status cards (name, active/managing state, fixture count) with grouped primary and secondary actions. The create/edit form SHALL be organized into labeled sections (identity, dates, format, providers, branding) with disabled/locked controls clearly communicated (e.g. slug locked once fixtures exist).

#### Scenario: Scanning competitions

- **WHEN** an admin views the competitions list
- **THEN** each competition appears as a card showing its status badges and fixture count with its actions grouped together

#### Scenario: Locked slug is explained

- **WHEN** a competition already has fixtures
- **THEN** the slug control is disabled and the UI explains why it cannot be changed

### Requirement: Fixtures management layout

The fixtures screen SHALL present fixtures in a dense, scannable table-style layout with clear status badges (e.g. unconfirmed, result overdue, final) and inline result entry, separating destructive and secondary actions from the primary result action. The on-demand result sync control MUST remain available and show its outcome.

#### Scenario: Reviewing fixtures

- **WHEN** an admin views the fixtures screen for the managed competition
- **THEN** fixtures are listed in a scannable layout with status badges and result entry reachable inline per fixture

#### Scenario: Destructive action is distinguished

- **WHEN** a fixture row exposes a delete action
- **THEN** the delete action is visually separated from primary/secondary actions to reduce accidental use

### Requirement: Quiz authoring layout

The quiz screen SHALL present daily-question authoring as a guided layout: prompt, four options with explicit correct-answer selection, schedule date, and optional Spanish/French translations grouped clearly. Scheduled questions SHALL be listed with translation-coverage indicators, and the resend-reminder control MUST report its result.

#### Scenario: Authoring a question

- **WHEN** an admin creates a daily question
- **THEN** the prompt, options, correct-answer selection, schedule, and optional translations are presented as a clear guided form

#### Scenario: Translation coverage is visible

- **WHEN** an admin views scheduled questions
- **THEN** each question indicates which translations (es/fr) are present

### Requirement: Consistent operational states

Admin screens SHALL provide consistent empty states, pending/loading feedback on server-action submissions, and explicit success/error feedback for operations (set active, sync results, resend emails, resend quiz reminder, create/update/delete).

#### Scenario: Pending feedback during an action

- **WHEN** an admin triggers a server action (e.g. sync results, set active, resend)
- **THEN** the triggering control shows a pending/disabled state until the action resolves

#### Scenario: Outcome feedback after an action

- **WHEN** a server action completes or fails
- **THEN** the screen shows a clear success or error message describing the outcome

#### Scenario: Empty list state

- **WHEN** a list (competitions, fixtures, scheduled questions) has no items
- **THEN** the screen shows a helpful empty state instead of a blank area

### Requirement: Responsive and accessible admin

Every admin screen SHALL be usable mobile-first and meet baseline accessibility: labeled controls, visible keyboard focus, logical tab order, accessible names for icon-only actions, and dialogs that trap focus and restore it on close.

#### Scenario: Operating on a phone

- **WHEN** an admin uses any admin screen on a small viewport
- **THEN** content, forms, and actions are reachable and operable without horizontal overflow of primary content

#### Scenario: Keyboard operation

- **WHEN** an admin navigates an admin screen by keyboard only
- **THEN** all interactive controls are focusable in a logical order with a visible focus indicator and accessible names

### Requirement: Localized admin copy preserved

The redesign SHALL keep all admin UI strings localized across en/es/fr. Any new copy introduced by the redesign (empty states, section labels, helper text) MUST be added as keys to all three locale message files; no user-facing admin string may be hard-coded.

#### Scenario: New copy is translated

- **WHEN** the redesign introduces new admin copy
- **THEN** corresponding keys exist in `messages/en.json`, `messages/es.json`, and `messages/fr.json` and are rendered via the i18n layer

#### Scenario: Switching locale

- **WHEN** an admin switches between en, es, and fr
- **THEN** all admin screens render their copy in the selected locale with no untranslated literals

