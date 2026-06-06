## 1. Filter helpers (lib/match-utils.ts)

- [x] 1.1 Add `parseTeamParam(raw: string | string[] | undefined): Set<string>` that normalizes a `?team=` value (comma-separated and/or repeated) into a set of trimmed, case-folded team keys
- [x] 1.2 Add `filterableTeams(matches: MatchRow[]): string[]` that returns distinct real country teams from the list, excluding placeholders (teams with no `flagSlug`), sorted for stable chip order
- [x] 1.3 Add `matchInvolvesTeam(match: MatchRow, selected: Set<string>): boolean` predicate (case-insensitive match on `home_team`/`away_team`); empty set returns true
- [x] 1.4 Reconcile the selected set against `filterableTeams` so unknown/placeholder param values are dropped before use
- [x] 1.5 Extend `tests/match-utils.test.ts` covering: comma + repeated param parsing, placeholder exclusion, single/multi team predicate, unknown-value drop, empty-set passthrough

## 2. Client filter control (components/match-team-filter.tsx)

- [x] 2.1 Create `"use client"` component taking `teams: string[]`, `selected: string[]`, and localized labels as props; render an "All" reset plus a chip per team with active styling matching existing chip/badge styles
- [x] 2.2 On toggle, build the next URL from `usePathname()` + `useSearchParams()`, mutate only the `team` key (omit it when selection is empty), and `router.replace` inside `useTransition` — preserving locale prefix and unrelated params (mirror `language-switcher.tsx`)
- [x] 2.3 Support multi-select toggle (add/remove team from current selection); "All" clears the selection
- [x] 2.4 Render each chip with its `TeamFlag` for visual parity with match rows; ensure horizontal overflow wraps/scrolls without layout shift and is keyboard-accessible

## 3. Wire the matches page (app/[locale]/(public)/matches/page.tsx)

- [x] 3.1 Add `searchParams: Promise<{ team?: string | string[] }>` to the page props and await it
- [x] 3.2 Parse the selected set via `parseTeamParam`, reconcile against `filterableTeams(list)`, then derive `filtered = list.filter(m => matchInvolvesTeam(m, selected))`
- [x] 3.3 Compute `byDay`, `dayEntries`, and `stats` from `filtered` (not the raw list) so counts track the filter
- [x] 3.4 Render `<MatchTeamFilter>` above the day list, passing `filterableTeams(list)` and the active selection
- [x] 3.5 Add a filter-aware empty state (selection matched nothing) distinct from the existing no-schedule empty state, including a clear-filter affordance

## 4. Localization

- [x] 4.1 Add `matches` namespace keys (filter label, "All", filtered empty title/body, clear filter) to `messages/en.json`
- [x] 4.2 Mirror the new keys in `messages/es.json` and `messages/fr.json` with translated copy

## 5. Verify

- [x] 5.1 Run the unit tests (`match-utils`) and the type/lint/build checks; fix any failures
- [ ] 5.2 Manually verify on `/matches`: select one team, select multiple, reset via "All", reload a `?team=` URL, back/forward navigation, and the filtered empty state — in en/es/fr
