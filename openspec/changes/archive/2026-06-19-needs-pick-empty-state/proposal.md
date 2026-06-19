## Why

Signed-in users get a "Needs Pick" toggle on `/matches` (`components/needs-pick-toggle.tsx`, `?picks=needed`) that narrows the list to fixtures they haven't predicted and that are still open. When that filter yields zero matches — because every remaining fixture is locked, live, or final — the page falls into the generic filtered-empty branch (`app/[locale]/(public)/matches/page.tsx:299-316`), which reads "No matches / No fixtures match your filters. Clear them to see the full schedule." That copy frames an actually-good outcome (the user is caught up) as a dead-end and only offers "Clear filters", suppressing re-engagement. QW9 in `análisis.md` calls this out: the empty state should say "All caught up — come back tomorrow" with a clear link back to all matches.

## What Changes

- Detect the specific case where the **needs-pick filter is active** (`?picks=needed`, signed-in) **and the result set is empty**, and render a dedicated "all caught up" empty state instead of the generic filtered-empty copy.
- The all-caught-up state SHALL show an encouraging title/body ("All caught up — come back tomorrow") and a link back to all matches (the existing `/matches` link, reused as "View all matches" rather than "Clear filters").
- Leave the generic filtered-empty state (team/status filters with no needs-pick) and the no-fixtures-loaded empty state unchanged.
- Add the new copy keys to the `matches` i18n namespace in `messages/{en,es,fr,de}.json`.

## Capabilities

### New Capabilities
- `needs-pick-empty-state`: A helpful empty state on `/matches` shown when the signed-in "Needs Pick" filter yields zero matches — an "all caught up, come back tomorrow" message with a link back to all matches, replacing the silent generic filtered-empty dead-end.

### Modified Capabilities
<!-- None at the spec level. The matches page's empty-state branch gains a needs-pick-specific case, but no existing capability spec changes its requirements. -->

## Impact

- **Matches page**: `app/[locale]/(public)/matches/page.tsx` — the empty-state branch (currently `isFiltered ? filterEmpty… : empty…`) gains a needs-pick-specific case keyed off the already-computed `picksNeeded` flag and `filtered.length === 0`. The all-caught-up case reuses the existing `localePath(locale, "/matches")` link with a "view all matches" label.
- **i18n**: new `matches` keys (e.g. `needsPickEmptyTitle`, `needsPickEmptyBody`, `needsPickEmptyAction`) in `messages/{en,es,fr,de}.json`.
- No schema changes, no new components, no new dependencies. The needs-pick count, filter state, and empty-state container all already exist.
