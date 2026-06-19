## 1. Server action

- [x] 1.1 Add `updateDisplayName(formData)` (e.g. `app/[locale]/profile-actions.ts`, `"use server"`): validate with the shared 2–32 trimmed zod schema, update `profiles.display_name` for the current user, `revalidatePath("/", "layout")`, return `{ ok: true }` or `{ ok: false, error }` (no redirect).
- [x] 1.2 Share the zod display-name schema with onboarding's `setDisplayName` (extract to one module) so validation can't drift.

## 2. UserMenu component

- [x] 2.1 Add `components/user-menu.tsx` (client) using the base-ui `Popover`: avatar/initial trigger (initial from display name, else email) with an accessible label; content shows display name + email.
- [x] 2.2 Inline edit form inside the popover: `Input` prefilled with the current name + Save button calling `updateDisplayName`; pending state; on success update the shown name locally and toast via `sonner`; on error toast the message and keep the old name.
- [x] 2.3 Sign-out as a POST `<form action="/sign-out">` button inside the popover (works without JS).
- [x] 2.4 Ensure accessibility: portal above the sticky nav, focus into the popover on open, Escape/outside-click close returning focus to the trigger.

## 3. Nav integration

- [x] 3.1 In `components/site-nav.tsx`, add `display_name` to the existing `profiles` select and render `<UserMenu displayName email />` in the action cluster for signed-in users (all breakpoints); keep the Sign in link for signed-out.
- [x] 3.2 Remove the standalone desktop sign-out form and the mobile-drawer sign-out block (`site-nav-client.tsx`) so sign-out lives only in the menu.

## 4. i18n

- [x] 4.1 Add a `profileMenu` namespace to `messages/en.json` (trigger aria label, "Signed in as"/account heading, name field label, Save, saved/success + error messages) and translate in `messages/{es,fr,de}.json`. Reuse `common.signOut` for the sign-out label.

## 5. Verification

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix failures.
- [x] 5.2 Manually verify: signed-in user sees the top-right menu at desktop + mobile widths; inline edit saves and the name updates without reload; invalid name (≤1 / >32) is rejected with an error; sign out works and no duplicate sign-out remains; keyboard/Escape/outside-click behave; all four locales render.
