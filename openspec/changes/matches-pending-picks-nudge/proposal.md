## Why

The retention engine relies almost entirely on the daily UTC batch email (`prediction-reminder-emails.ts`), so the "you still have picks to make" nudge arrives detached from the moment of use — and is degraded today by the unverified prod sender. Meanwhile `/matches` already computes `needsPickCount` for signed-in users (`app/[locale]/(public)/matches/page.tsx`) and ships a `NeedsPickToggle` that filters to those fixtures, but nothing surfaces that count until the user thinks to toggle it. Quick win QW2 from `análisis.md` closes that gap: nudge at the point of highest engagement, in-app, when the user is already on the page.

## What Changes

- On `/[locale]/matches`, when a **signed-in** user has at least one upcoming fixture still needing a pick (`needsPickCount > 0`), render a dismissible in-app banner at the top of the page stating how many upcoming matches still need a pick.
- The banner offers a CTA that filters the list to those fixtures by activating the existing `?picks=needed` filter (the same state `NeedsPickToggle` writes), reusing the already-computed `needsPickCount`.
- The banner is dismissible; once dismissed it stays hidden for that session (client-side), so it nudges without nagging.
- The banner is suppressed when `needsPickCount` is 0, when the `?picks=needed` filter is already active, and for anonymous visitors — no extra query is issued, since the count already exists.
- Add localized strings (banner copy, CTA, dismiss label) to `messages/{de,en,es,fr}.json`.

Non-goals: push or browser notifications; any change to the daily reminder email or its cron; timezone segmentation of nudges; a "locks in N minutes" badge; changing the pick/lock/scoring flow or the empty-state copy.

## Capabilities

### New Capabilities
- `matches-pending-picks-nudge`: a dismissible in-app banner on `/matches` that tells a signed-in user how many upcoming fixtures still need a pick and links them to the needs-pick filter.

### Modified Capabilities

## Impact

- **App**: `app/[locale]/(public)/matches/page.tsx` — render the banner above the existing filters when `user` is signed in and `needsPickCount > 0` and the picks filter is not already active; pass the count, the CTA target (the `?picks=needed` URL/filter), and localized strings.
- **Component**: a new client component (e.g. `components/pending-picks-nudge.tsx`) that owns the dismiss state and triggers the `?picks=needed` filter on its CTA (reusing `useQueryParamWriter`, like `NeedsPickToggle`).
- **i18n**: new `matches.*` nudge strings added to `messages/{de,en,es,fr}.json`.
- **Data**: none — reuses the existing per-user predictions read and `needsPickCount`; no schema, RLS, or query change.
