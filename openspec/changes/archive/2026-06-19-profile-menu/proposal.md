## Why

A signed-in user's only account control today is a bare "Sign out" button in the nav (and a duplicate in the mobile drawer). There is no way to see or change your display name after onboarding — the name shown on the leaderboard, picks, and groups — without an admin or a DB edit. A single top-right profile menu consolidates these: who you are, edit your name, and sign out.

## What Changes

- Add a collapsible **profile menu** in the top-right of the nav for signed-in users (a popover triggered by an avatar/initial button). Signed-out users keep the existing **Sign in** link.
- The menu shows the current display name and email, an **inline display-name editor** (edit + Save without leaving the page), and **Sign out**.
- Add an `updateDisplayName` server action that validates (2–32 chars), persists to `profiles.display_name`, revalidates, and returns a result (no redirect) so the menu can show inline success/error and reflect the new name without a full reload.
- Consolidate sign-out into the menu: remove the standalone desktop sign-out form and the mobile-drawer sign-out (the menu is shown at all breakpoints), keeping a single sign-out control.
- Add a `profileMenu` i18n namespace (en/es/fr/de).

## Capabilities

### New Capabilities
- `profile-menu`: A top-right collapsible account menu for signed-in users — shows identity, lets them edit their display name inline (validated, persisted, reflected without reload), and sign out; accessible and localized.

### Modified Capabilities
<!-- None at the spec level. The nav (site navigation) gains the menu and drops the duplicated sign-out controls, but no existing capability spec changes its requirements. Onboarding's first-time display-name flow is unchanged. -->

## Impact

- **New component**: `components/user-menu.tsx` (client) using the base-ui Popover.
- **New server action**: `updateDisplayName` (e.g. `app/[locale]/profile-actions.ts`) — a non-redirecting sibling of onboarding's `setDisplayName`.
- **Navigation**: `components/site-nav.tsx` selects `display_name` (alongside the existing `is_admin` read) and renders `UserMenu` for signed-in users; `components/site-nav-client.tsx` drops the drawer sign-out.
- **i18n**: new `profileMenu` namespace in `messages/{en,es,fr,de}.json`; reuses `common.signOut`.
- **Feedback**: uses the existing `sonner` toaster for save success/error.
- No schema changes (column exists), no new dependencies (base-ui already present).
