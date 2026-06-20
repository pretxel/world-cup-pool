## Why

Updating (or submitting) a pick throws at runtime:

```
Error: A "use server" file can only export async functions, found object.
```

`app/[locale]/profile-actions.ts` carries the `"use server"` directive, so every one of its exports must be an async function. The push-notifications change added `export const pushSubscriptionSchema = z.object({…})` (and `export type PushSubscriptionInput`) to that file. A non-function export makes Next.js reject the whole module at runtime. Because `SiteNav` → `UserMenu` imports `updateDisplayName` from this module, **every page that renders the nav (including the match detail page where picks are submitted) errors** — which is why "update my pick" fails. This is currently live in production.

## What Changes

- Stop exporting the non-function value(s) from the `"use server"` module: `pushSubscriptionSchema` and `PushSubscriptionInput` in `app/[locale]/profile-actions.ts` are used only inside that file, so drop the `export` keyword (keep them as module-local). The `savePushSubscription` / `removePushSubscription` / `updateDisplayName` async actions are unchanged.
- (If a schema or type ever needs sharing, it must live in a non-`"use server"` module — but no external consumer exists today.)

## Capabilities

### New Capabilities
- `fix-update-pick-error`: server-action modules (`"use server"`) export only async functions; submitting/updating a pick persists without the invalid-use-server runtime error.

### Modified Capabilities
<!-- None at the spec level; this restores intended behavior of existing prediction submission. -->

## Impact

- **File**: `app/[locale]/profile-actions.ts` — remove `export` from `pushSubscriptionSchema` + `PushSubscriptionInput` (both internal-only; verified no external importers).
- **Effect**: unblocks `updateDisplayName` and the push subscribe actions, and every page importing them (the whole nav) — restoring pick submit/update.
- No schema, API surface, or behavior change beyond removing the erroneous exports. Add a guard test so a non-async export in a `"use server"` actions file is caught before shipping.
