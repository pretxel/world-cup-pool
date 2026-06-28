## ADDED Requirements

### Requirement: User registration and sign-in
The system SHALL allow visitors to create an account and sign in using an email magic link, backed by Supabase Auth.

#### Scenario: Sign up with magic link
- **WHEN** a visitor submits a valid email address on the sign-in page
- **THEN** the system sends a magic-link email and displays a "check your email" confirmation, and clicking the link signs the user in and creates a `profiles` row if one does not yet exist.

#### Scenario: Sign-in with malformed email
- **WHEN** a visitor submits an email that fails RFC 5321 validation
- **THEN** the system rejects the submission, displays an inline validation error, and does not send an email.

### Requirement: Profile and display name
The system SHALL store a `profiles` record per authenticated user containing a unique display name (2–32 characters) used on leaderboards, and SHALL allow the owner of that profile to edit the display name.

#### Scenario: Set display name on first sign-in
- **WHEN** a user signs in for the first time and the profile has no display name
- **THEN** the system prompts for a display name before allowing access to the predictions page and persists it in `profiles.display_name`.

#### Scenario: Edit display name later
- **WHEN** an authenticated user updates their display name from the profile page with a value of 2–32 characters
- **THEN** the system saves the new value and it appears on subsequent leaderboard renders.

#### Scenario: Reject invalid display name length
- **WHEN** an authenticated user submits a display name shorter than 2 or longer than 32 characters
- **THEN** the system rejects the change, returns a validation error, and leaves the prior value intact.

### Requirement: Session management
The system SHALL maintain authenticated sessions using cookie-based Supabase SSR, expose a sign-out action, and require authentication for any prediction-write or admin route.

#### Scenario: Authenticated session persists across pages
- **WHEN** a signed-in user navigates between pages of the app
- **THEN** the server reads the Supabase auth cookie on each request and renders pages in a signed-in state without requiring re-authentication.

#### Scenario: Sign out clears session
- **WHEN** an authenticated user clicks "Sign out"
- **THEN** the system clears the Supabase auth cookies and the next request renders the unauthenticated landing page.

#### Scenario: Unauthenticated user blocked from picks
- **WHEN** an unauthenticated visitor navigates to a route that submits or edits predictions
- **THEN** the system redirects them to the sign-in page and, after successful sign-in, returns them to the original route.

### Requirement: Admin role
The system SHALL support an `is_admin` boolean on `profiles` that gates access to fixture and final-score management.

#### Scenario: Admin sees admin navigation
- **WHEN** a user with `profiles.is_admin = true` loads the app
- **THEN** the navigation surfaces an "Admin" link to the fixture and results management pages.

#### Scenario: Non-admin denied admin actions
- **WHEN** a user with `profiles.is_admin = false` (or unauthenticated) calls an admin server action or route
- **THEN** the server returns a 403 / authorization error and the database RLS policy refuses the underlying write.
