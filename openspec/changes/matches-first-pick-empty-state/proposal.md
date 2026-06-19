## Why

After onboarding (sign-in → display name → navigate to a fixture), a brand-new signed-in user lands on `/matches` having made zero picks. The page renders the full day-grouped fixture list with no acknowledgement that they haven't started, so the time-to-first-prediction depends on the user scanning the list and guessing what to do. The only empty state today (`emptyTitle` / `filterEmptyTitle` in `app/[locale]/(public)/matches/page.tsx`) shows up just when the rendered list is empty (no fixtures, or no fixtures matching a filter) — it never appears for a new user who simply hasn't picked yet, because the list is full of matches.

This is engagement quick win **QW8** from `análisis.md`: reduce time-to-first-prediction by showing an inviting "Make your first pick" lead state on `/matches` for a signed-in user who has no picks and no active filters, pointing them at the soonest still-pickable match.

## What Changes

- Add a **first-pick lead state** at the top of `/matches`, above the day sections, shown only when: the visitor is signed in, has made **zero picks**, **no filters are active** (`isFiltered === false`), and there is at least one still-pickable match. It does not replace the fixture list — the list still renders below it.
- The lead state highlights the **soonest still-pickable match** (earliest unlocked, scheduled, confirmed fixture by kickoff) with a clear "Make your first pick" call-to-action linking straight to that match's detail page (`/matches/{id}`).
- When the user has no picks but **every** confirmed match is already locked/live/final (nothing pickable), the lead state shows an encouraging "no open matches right now" message instead of a dead CTA, rather than rendering nothing.
- The existing list-empty states (`emptyTitle`, `filterEmptyTitle`) and the needs-pick / status / team filters are unchanged. Once the user has at least one pick, or any filter is active, the lead state does not render.
- Add a `firstPick` block to the `matches` i18n namespace (en/es/fr/de): eyebrow, title, CTA label, and the "no open matches" copy.

## Capabilities

### New Capabilities
- `matches-first-pick-empty-state`: A first-pick lead state on the public `/matches` page for a signed-in user with no picks and no active filters — it surfaces the soonest still-pickable match with a "Make your first pick" CTA (or an encouraging message when nothing is currently pickable), localized, without replacing the fixture list.

### Modified Capabilities

<!-- None. The existing list-empty states and the team/status/needs-pick filters keep their behavior; this adds a sibling lead state above the list. -->

## Impact

- **Page**: `app/[locale]/(public)/matches/page.tsx` — compute the soonest pickable match and a `showFirstPick` flag from data already in scope (`user`, `pickedIds`, `isFiltered`, the confirmed `list`), and render the lead state above the day sections.
- **Helper**: `lib/match-utils.ts` — add a small pure helper to pick the soonest still-pickable match (reusing `isLocked` / `isConfirmedMatch` semantics) so the page stays declarative and the logic is unit-testable.
- **i18n**: new `matches.firstPick` keys in `messages/{en,es,fr,de}.json`.
- No schema changes, no new dependencies. Anonymous visitors and users with existing picks see no change.
