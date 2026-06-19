## ADDED Requirements

### Requirement: Per-type email preference store

The system SHALL persist, per player, an independent on/off preference for each email type it sends — the prediction reminder, the result email, and the quiz reminder — in a single `profiles.email_prefs` field. Each type SHALL default to opted-in, and a missing or unrecognized value for a type SHALL be treated as opted-in. The store SHALL be backfilled from any existing per-type opt-out so no current choice is lost.

#### Scenario: Defaults to opted-in
- **WHEN** a profile has no explicit preference recorded for an email type
- **THEN** that email type is treated as opted-in for the player

#### Scenario: Backfill preserves existing opt-outs
- **WHEN** the preference store is introduced for a player who had previously opted out of an email type
- **THEN** that player's preference for that type is opted-out, and types they never opted out of are opted-in

### Requirement: In-app per-type email toggles

The account menu SHALL present a toggle for each email type, initialized from the player's current preferences, and SHALL let the player turn any type on or off without navigating away. On save the system SHALL persist the change for the current player and SHALL surface inline confirmation; on failure it SHALL surface an error and leave the stored preference unchanged.

#### Scenario: Player opts out of one email type
- **WHEN** an authenticated player turns off the toggle for one email type and it saves
- **THEN** that type is recorded as opted-out for the player
- **AND** the other email types' preferences are unchanged
- **AND** a success confirmation is shown without a full page reload

#### Scenario: Player re-opts in
- **WHEN** a player who is currently opted out of an email type turns its toggle back on and it saves
- **THEN** that type is recorded as opted-in for the player

#### Scenario: Save failure keeps prior state
- **WHEN** saving a preference change fails
- **THEN** an error is shown and the player's stored preference is unchanged

#### Scenario: Toggles reflect current preferences on open
- **WHEN** the account menu is opened
- **THEN** each email type's toggle shows the player's currently stored preference

### Requirement: Dispatch honors per-type preferences

Every email dispatch path SHALL exclude any player who is opted out of that email's type, while continuing to send to players who are opted in or have no explicit preference. This SHALL apply to the prediction reminder, the result email, and the quiz reminder.

#### Scenario: Opted-out player is excluded
- **WHEN** an email of a given type is dispatched and a player is opted out of that type
- **THEN** that player does not receive the email

#### Scenario: Opted-in player still receives
- **WHEN** an email of a given type is dispatched and a player is opted in to that type (or has no explicit preference)
- **THEN** that player receives the email if otherwise eligible

#### Scenario: Result emails respect opt-out
- **WHEN** a result email would be sent to a player who has opted out of result emails
- **THEN** that player does not receive the result email even though the result email had no opt-out before this change

### Requirement: Footer unsubscribe stays consistent with in-app preferences

A one-click unsubscribe from an email footer SHALL update the same per-type preference that the in-app toggle controls, so the change is reflected in the account menu and can be reversed there.

#### Scenario: Footer unsubscribe shows in the menu
- **WHEN** a player uses the one-click unsubscribe link in an email footer for a type
- **THEN** that type's preference is recorded as opted-out
- **AND** the corresponding toggle in the account menu shows opted-out and can be turned back on

### Requirement: Localized preference UI

The email-preference toggle labels and their feedback messages SHALL render in the active locale (en, es, fr, de).

#### Scenario: Localized rendering
- **WHEN** the preference toggles are used under a supported locale
- **THEN** their labels and feedback messages render in that locale
