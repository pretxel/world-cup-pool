## ADDED Requirements

### Requirement: Top-right profile menu for signed-in users

The system SHALL render a collapsible profile menu in the top-right of the primary navigation for authenticated users, opened from an avatar/initial trigger. Unauthenticated users SHALL instead see the Sign in control. The menu SHALL be available at all viewport sizes.

#### Scenario: Signed-in user sees the menu
- **WHEN** an authenticated user views any page with the nav
- **THEN** a profile trigger appears in the top-right and opens the menu when activated

#### Scenario: Signed-out user sees Sign in
- **WHEN** an unauthenticated visitor views the nav
- **THEN** no profile menu is shown and a Sign in control is present

#### Scenario: Identity shown
- **WHEN** the menu is open
- **THEN** it shows the user's current display name (or email when no name is set) and email

### Requirement: Sign out from the menu

The profile menu SHALL contain a single Sign out control that ends the session, and the application SHALL NOT present duplicate sign-out controls elsewhere in the nav.

#### Scenario: Sign out
- **WHEN** the user activates Sign out in the menu
- **THEN** the session is ended and the user is returned to the public site

#### Scenario: No duplicate sign-out
- **WHEN** the profile menu is present
- **THEN** there is no separate sign-out button outside the menu

### Requirement: Inline display-name editing

The profile menu SHALL let the user edit their display name inline and save it without navigating away. The system SHALL validate the name as a trimmed string of 2–32 characters and persist it to the user's profile. On success the menu SHALL reflect the new name immediately and surface confirmation; on failure it SHALL surface an error and leave the stored name unchanged.

#### Scenario: Successful edit
- **WHEN** the user enters a valid name (2–32 chars after trimming) and saves
- **THEN** the name is persisted to their profile
- **AND** the menu shows the new name without a full page reload
- **AND** a success confirmation is shown

#### Scenario: Invalid name rejected
- **WHEN** the user submits a name shorter than 2 or longer than 32 characters (after trimming)
- **THEN** the name is not saved and an error is shown

#### Scenario: Other surfaces reflect the change
- **WHEN** a display name is saved
- **THEN** server-rendered surfaces that show the name reflect the new value on their next load

### Requirement: Accessible, dismissible menu

The menu SHALL be operable by keyboard and screen reader: the trigger has an accessible label, focus moves into the menu on open, and the menu closes on Escape or outside click.

#### Scenario: Keyboard open and dismiss
- **WHEN** the user focuses the trigger and activates it, then presses Escape
- **THEN** the menu opens with focus moved into it and closes on Escape, returning focus to the trigger

#### Scenario: Outside click dismiss
- **WHEN** the menu is open and the user clicks outside it
- **THEN** the menu closes

### Requirement: Localized menu

The menu's labels, the edit form, and its feedback messages SHALL render in the active locale (en, es, fr, de).

#### Scenario: Localized rendering
- **WHEN** the menu is used under a supported locale
- **THEN** its labels and messages render in that locale
