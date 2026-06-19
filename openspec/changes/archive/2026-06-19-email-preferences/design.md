## Context

Three email types ship today, each with its own dispatch module under `lib/notifications/`:

- `prediction-reminder-emails.ts` selects recipients with `loadOptedInProfiles` → `.from("profiles").select("id, display_name, unsubscribe_token").eq("prediction_reminder_opt_out", false)`.
- `quiz-reminder-emails.ts` does the same with `.eq("quiz_reminder_opt_out", false)`.
- `result-emails.ts` does **not** read `profiles` for an opt-out at all — `computePendingByUser` derives recipients purely from scored final matches and the `result_email_log` ledger, so there is no result opt-out anywhere.

The opt-out booleans live on `profiles` (`quiz_reminder_opt_out`, `prediction_reminder_opt_out`, both `not null default false`) plus a unique `unsubscribe_token` used by the footer one-click routes (`/api/quiz-reminders/unsubscribe`, `/api/prediction-reminders/unsubscribe`). There is no in-app UI for any of this — `análisis.md` item 10 / QW7 notes the toggles exist in the DB but not in the product.

The account surface is `components/user-menu.tsx`: a base-ui `Popover` (client) fed by `components/site-nav.tsx` (server), already wired to a non-redirecting server action (`updateDisplayName` in `app/[locale]/profile-actions.ts`) that returns a typed result and shows `sonner` toasts. `revalidatePath("/", "layout")` refreshes server-rendered surfaces.

## Goals / Non-Goals

**Goals:**
- A player can independently toggle each of the three email types on/off from the account menu, saved without leaving the page.
- A single in-app source of truth for the toggles, with the three dispatch paths honoring it — including the result email, which has no opt-out today.
- The existing footer one-click unsubscribe keeps working and stays consistent with the in-app state (re-opt-in is possible from the menu).

**Non-Goals:**
- No new email types, no global "pause all" master switch, no digest/frequency controls.
- No new unsubscribe routes or auth changes; the footer flow is reused.
- No removal of the legacy boolean columns (kept so the footer routes are untouched); they are simply no longer the read source.
- No timezone, locale-of-email, or per-group preference scope.

## Decisions

### Decision: single jsonb `profiles.email_prefs` as the source of truth
Add `profiles.email_prefs jsonb not null default '{"prediction_reminder":true,"result":true,"quiz_reminder":true}'`. One column holds all three toggles, defaulting to opted-in (the features email everyone eligible). The migration backfills it from the existing booleans (`prediction_reminder = not prediction_reminder_opt_out`, `quiz_reminder = not quiz_reminder_opt_out`, `result = true` since no prior opt-out existed) so current choices carry over.

*Why jsonb over a third boolean:* the task brief asks for it, and a single column adds the missing result toggle without three more migrations or three more `.eq(...)` filters drifting apart. A reader treats a missing key as opted-in (`!== false`), so partial rows are safe.

*Alternative considered:* add a `result_opt_out` boolean and keep three booleans — rejected; more columns, more select churn, and no single object to send to the client.

### Decision: dispatch paths read the jsonb key, not the booleans
`loadOptedInProfiles` in the prediction and quiz modules switches from `.eq("<type>_opt_out", false)` to selecting `email_prefs` and keeping recipients where `email_prefs->><type>` is not `'false'` (treating absent/unknown as opted-in). `result-emails.ts` adds a profiles read for the affected `userIds` and drops anyone whose `email_prefs->>'result'` is `'false'` before `dispatchPending`. Filtering in the query (or right after the existing standings read) keeps the change localized and the paged loaders intact.

### Decision: `updateEmailPrefs` server action mirrors `updateDisplayName`
Add `updateEmailPrefs(prefs)` to `app/[locale]/profile-actions.ts` (`"use server"`): validate the payload with a small zod schema (the three known boolean keys), `update profiles set email_prefs = <merged> where id = user.id`, `revalidatePath("/", "layout")`, and return `{ ok: true; prefs }` or `{ ok: false; error }` — no redirect, so the menu stays open and shows inline feedback exactly like the name editor.

### Decision: footer unsubscribe writes the same jsonb key
The two existing one-click unsubscribe routes also set the matching `email_prefs` key to `false` (alongside or instead of the legacy boolean) so an unsubscribe from the footer is visible in the menu and can be reversed there. This is the only way footer and in-app stay consistent; otherwise a footer opt-out would be invisible to the toggle.

### Decision: UI is a toggle list in the existing popover
Add a small preferences section to `components/user-menu.tsx` below the name editor: one labeled switch per email type, initialized from the `email_prefs` passed down by `site-nav.tsx`. Flipping a switch calls `updateEmailPrefs` in a transition, toasts on success/error, and keeps optimistic local state. No new surface or route.

## Risks / Trade-offs

- **Two sources (jsonb + legacy booleans) drifting** → the jsonb is the single read source for dispatch and the menu; the booleans are write-through only from the footer, which we also point at the jsonb. Backfill keeps day-one parity. Trade-off accepted to avoid touching the unsubscribe routes' contracts.
- **Result emails currently reach everyone** → adding the filter means previously-reached players who set `result:false` will stop; that is the intended fix, and default-on preserves behavior for everyone who never touches the toggle.
- **Malformed/partial jsonb** → readers use `!== false` semantics so a missing or non-boolean key is treated as opted-in; the action validates before writing, and the column default guarantees a complete object for new rows.
- **Optimistic toggle vs. failed save** → on error the toast fires and the switch reverts to the last persisted value, matching the name-editor pattern.
