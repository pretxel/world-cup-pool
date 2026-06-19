## 1. Match selection helper

- [ ] 1.1 Add a pure `soonestPickableMatch(matches, pickedIds)` helper to `lib/match-utils.ts` that, over a kickoff-ASC list, returns the first match where `needsPick(match, pickedIds)` is true, else `null`. Reuse the existing `isLocked` / `needsPick` semantics so it can't diverge from the lock rules.

## 2. Page lead state

- [ ] 2.1 In `app/[locale]/(public)/matches/page.tsx`, compute `showFirstPick = user != null && pickedIds.size === 0 && !isFiltered` and `firstPickMatch = showFirstPick ? soonestPickableMatch(list, pickedIds) : null` from data already in scope.
- [ ] 2.2 Render the first-pick lead state above the `<div className="space-y-12">` day-section block, only when `showFirstPick` is true; keep the fixture list rendering below it unchanged.
- [ ] 2.3 When `firstPickMatch` is non-null, show the eyebrow + "Make your first pick" title + a CTA link to `localePath(locale, \`/matches/${firstPickMatch.id}\`)` using the page's existing pill/link style. When it is `null`, show the eyebrow + the encouraging no-open-matches message and no CTA link.
- [ ] 2.4 Leave the existing `filtered.length === 0` empty block (`emptyTitle` / `filterEmptyTitle`) and the team/status/needs-pick filters untouched.

## 3. i18n

- [ ] 3.1 Add a `firstPick` block to the `matches` namespace in `messages/en.json` (`eyebrow`, `title`, `cta`, `noneTitle`, `noneBody`) and translate it in `messages/{es,fr,de}.json`, matching the namespace's existing key style.

## 4. Verification

- [ ] 4.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`; fix any failures (add/extend a unit test for `soonestPickableMatch` covering: first match open, leading matches locked/live/final, and all-locked → `null`).
- [ ] 4.2 Manually verify on `/matches`: a signed-in user with zero picks and no filters sees the lead state above the list with a CTA to the soonest open match; making one pick (or activating any filter) hides it; an anonymous visitor never sees it; with every fixture locked/live/final the encouraging no-open-matches message shows with no CTA; all four locales render correctly.
