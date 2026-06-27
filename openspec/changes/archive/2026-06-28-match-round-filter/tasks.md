## 1. Helpers

- [x] 1.1 In `lib/match-utils.ts`, add `parseRoundParam(raw: string | string[] | undefined): string | null` (first value, trimmed; empty → null), mirroring `parseStatusParam`.
- [x] 1.2 In `lib/match-utils.ts`, add `stagesPresent(matches: { stage: string }[]): Set<string>` returning the distinct `stage` values present.

## 2. Round filter control

- [x] 2.1 Create `components/match-round-filter.tsx` (client), mirroring `match-team-filter.tsx`: props `rounds: {key,label}[]`, `selected: string | null`, `allLabel`, `label`. Render an "All rounds" chip + one chip per round; single-select; write `?round=` via `useQueryParamWriter` (clear when selecting active or "All").

## 3. Page wiring

- [x] 3.1 In `app/[locale]/(public)/matches/page.tsx`, read `round` from `searchParams`; compute `present = stagesPresent(list)` and `roundOptions = sortedStages(format).filter(s => present.has(s.key)).map(s => ({ key: s.key, label: getStageLabel(format, s.key, locale) }))`.
- [x] 3.2 Validate the param: `selectedRound = parseRoundParam(roundParam)` only if it is in `present`, else null.
- [x] 3.3 Apply the round filter into the scoped set before stats: `scoped = teamFiltered.filter(m => !selectedRound || m.stage === selectedRound)`; compute the status stats and needs-pick count from `scoped`; then apply status/picks as today.
- [x] 3.4 Render `<MatchRoundFilter>` (above the team filter) and include `selectedRound` in the `isFiltered` flag and the clear-filters/empty-state logic.

## 4. i18n

- [x] 4.1 Add a round-filter group label and an "All rounds" option label to the `matches` namespace in `messages/en.json`, `es.json`, `fr.json`, `de.json` (round names reuse the competition format's stage labels).

## 5. Verify

- [x] 5.1 Unit tests: `parseRoundParam` (string, array, empty/undefined → null); `stagesPresent` returns distinct stages.
- [x] 5.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test` and confirm they pass.
- [~] 5.3 Manually verify on `/matches`: round chips reflect present rounds in stage order with localized labels; selecting a round shows only that round and updates the status stats; it composes with team/status filters; empty days hidden; `?round=` is in the URL and survives reload; an unknown `round` value falls back to "All rounds". (SSR-verified: `/matches` returns 200 and renders the "Filter by round" control with "All rounds" + localized round chips. Interactive click → `?round=` → filter relies on the shared `useQueryParamWriter` + server-side round gating, both unit-tested; full in-browser click-through not yet exercised.)
