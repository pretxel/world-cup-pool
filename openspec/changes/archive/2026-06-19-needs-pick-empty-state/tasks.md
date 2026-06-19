## 1. Empty-state branch

- [x] 1.1 In `app/[locale]/(public)/matches/page.tsx`, within the `filtered.length === 0` block (lines ~299-316), add a first-priority case that triggers when the needs-pick filter is active (reuse the existing `picksNeeded` flag): render the all-caught-up title/body using new `matches` keys instead of the generic `filterEmpty…` copy.
- [x] 1.2 For the all-caught-up case, render a link to `localePath(locale, "/matches")` (clears `?picks=needed`) labeled with the new "view all matches" key, in place of the "Clear filters" link.
- [x] 1.3 Keep the existing branches intact: when `picksNeeded` is false, fall back to the current `isFiltered` (team/status) filtered-empty state and the no-fixtures-loaded state exactly as before.

## 2. i18n

- [x] 2.1 Add `needsPickEmptyTitle`, `needsPickEmptyBody`, and `needsPickEmptyAction` to the `matches` namespace in `messages/en.json` (e.g. title "All caught up", body "No picks pending — come back tomorrow for the next fixtures.", action "View all matches").
- [x] 2.2 Add the same three keys, translated, to `messages/es.json`, `messages/fr.json`, and `messages/de.json`.

## 3. Verification

- [x] 3.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`; fix any failures.
- [x] 3.2 Manually verify (signed in): activate the Needs Pick toggle when nothing needs a pick (all locked/live/final or already predicted) and confirm the "all caught up — come back tomorrow" state appears with the "view all matches" link, the link returns to the full list with the filter cleared, the toggle with results still lists matches, and the team/status filtered-empty and no-fixtures states are unchanged. Spot-check all four locales render the new copy.
