## ADDED Requirements

### Requirement: Server-action modules export only async functions

Every module carrying the `"use server"` directive SHALL export only async functions (plus type-only exports). Non-function values such as Zod schemas or constants SHALL NOT be exported from a `"use server"` module; they MUST remain module-local or live in a non-`"use server"` module.

#### Scenario: Profile actions module is valid
- **WHEN** `app/[locale]/profile-actions.ts` is loaded at runtime
- **THEN** it raises no `A "use server" file can only export async functions` error
- **AND** its only non-type exports are async server actions (`updateDisplayName`, `savePushSubscription`, `removePushSubscription`)

#### Scenario: Internal schema stays internal
- **WHEN** a server-action file needs a validation schema used only within it
- **THEN** that schema is declared without `export`

### Requirement: Submitting and updating a pick succeeds

A signed-in, non-admin user SHALL be able to submit a new pick and update an existing pick for a scheduled, not-yet-locked match without a runtime error, and the saved scoreline SHALL persist.

#### Scenario: Update an existing pick
- **WHEN** a signed-in user changes the scoreline of an existing pick on a scheduled match before kickoff and saves
- **THEN** the prediction is persisted with the new scoreline
- **AND** no `invalid-use-server` (or other module-load) error is thrown

#### Scenario: Nav-bearing pages load
- **WHEN** any page that renders the site navigation (which imports the profile actions) is requested
- **THEN** the page renders without the invalid-use-server module error

### Requirement: Regression guard

The test suite SHALL include a check that fails when a `"use server"` actions module exports a non-async-function, non-type value.

#### Scenario: Guard catches a bad export
- **WHEN** a `"use server"` file adds an `export const`/`export {}` of a non-function value
- **THEN** the guard test fails
