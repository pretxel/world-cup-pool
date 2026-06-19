## Context

The nav (`components/site-nav.tsx`, a server component) already resolves the current user via `supabase.auth.getUser()` and, for signed-in users, queries `profiles` for `is_admin`. Sign-out is a `<form method="post" action="/sign-out">` shown on desktop, duplicated in the mobile drawer (`site-nav-client.tsx`). Display name lives in `profiles.display_name`; onboarding's `setDisplayName` action validates 2–32 chars and updates it, but it `redirect`s afterward, so it can't back an in-place edit.

UI primitives use base-ui (`@base-ui/react`, already a dependency); `components/ui/dialog.tsx` shows the wrapper pattern. base-ui exposes `popover` and `menu`. A `sonner` toaster is already mounted for transient feedback.

## Goals / Non-Goals

**Goals:**
- One top-right collapsible profile menu for signed-in users; Sign in link otherwise.
- Inline display-name edit that saves without navigating away and reflects immediately.
- Sign out from the menu; remove the now-duplicate sign-out controls.
- Accessible (keyboard, focus, aria), localized.

**Non-Goals:**
- Avatar image upload, email change, password, or other profile fields (name only; `/profile` page deferred).
- Changing the onboarding first-run flow.
- Any schema change.

## Decisions

### Decision: base-ui Popover (not Menu) for an inline form
A Menu closes on item activation, which fights an inline text field. Use `Popover`: trigger is an avatar/initial button; content holds the identity header, the edit form, and the sign-out form. The popover closes on outside-click/Escape (base-ui default) but stays open while typing/saving.

*Alternative considered:* Menu + a Dialog for editing — rejected per the chosen inline UX (more clicks, extra surface).

### Decision: `updateDisplayName` server action returns a result, no redirect
Add a non-redirecting action (validate 2–32 with the same zod rule as onboarding; `update profiles … where id = user.id`; `revalidatePath("/", "layout")` so server-rendered names refresh; return `{ ok: true }` or `{ ok: false, error }`). The client form calls it, shows a `sonner` toast, and on success updates its local displayed name optimistically (revalidation refreshes the rest on next navigation).

*Why a new action:* onboarding's `setDisplayName` redirects to `/matches`; reusing it would bounce the user off the page. Both can share the zod schema.

*Alternative considered:* a route handler — rejected; a server action is the idiomatic fit and gives typed results.

### Decision: `UserMenu` client component fed by the server nav
`site-nav.tsx` adds `display_name` to its existing `profiles` select and passes `{ displayName, email }` to `<UserMenu>`. The trigger shows the initial (from display name, else email) in a circle. The component is the only client island added; the nav stays a server component.

### Decision: Consolidate sign-out
Render `UserMenu` in the nav's action cluster at all breakpoints for signed-in users; remove the standalone desktop sign-out form and the drawer's sign-out block so there is exactly one sign-out. The mobile hamburger keeps the page links only. Sign-out stays a POST form to `/sign-out` (works without JS) inside the popover.

### Decision: Optimistic local name + revalidation
On save success, the menu updates its shown name immediately (local state) and the action's `revalidatePath` ensures other surfaces (leaderboard, picks) pick up the change on their next load. Avoids a hard reload while keeping data consistent.

## Risks / Trade-offs

- **Popover with a form inside the nav header** → ensure it renders in a portal above sticky nav and traps focus; rely on base-ui Popover semantics and test keyboard/Escape/outside-click.
- **Stale name elsewhere until navigation** → acceptable; `revalidatePath("/", "layout")` covers subsequent loads, and the menu itself shows the new value immediately.
- **Removing drawer sign-out could strand mobile users if the menu isn't reachable** → `UserMenu` renders at all breakpoints in the top-right cluster, so sign-out is always one tap away.
- **Validation drift from onboarding** → share the single zod schema (2–32, trimmed) between both actions.

## Migration Plan

Additive/behavioral: new component + action + i18n namespace; nav swaps two sign-out controls for one menu. No schema or data migration. Rollback = restore the sign-out form/drawer block and drop the menu.

## Open Questions

- None blocking. (A dedicated `/profile` page can layer on later if more fields appear — the action and component are reusable.)
