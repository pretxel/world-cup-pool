## 1. Results-table data loader

- [x] 1.1 Add `lib/group-table.ts` (server-only) that resolves the active competition via `getActiveCompetition()` and its group-stage key via `groupStageKey(format)`; returns `[]` when the competition has no group stage.
- [x] 1.2 In the loader, select group-stage matches for the active competition (`id, home_team, away_team, group_code, home_score, away_score, status`), build a `Map<matchId, {home_goals, away_goals}>` from rows where `status === 'final'` and both scores are non-null, and pass fixtures + map to `simulateAllGroups`.
- [x] 1.3 Return the matches list alongside the `SimulatedGroup[]` (or expose a helper) so the page can call `maybeScheduleOpportunisticSync` with the raw rows.
- [x] 1.4 Add unit tests in `tests/` covering: only `final` results counted; scheduled/live/cancelled and score-null finals skipped; all teams seeded at played=0 pre-tournament; partial group stage; ordering (points → GD → GF → name).

## 2. Generalize the standings table component

- [x] 2.1 Add an optional `source: "picks" | "results"` prop to `GroupStandingsTable` (and `AllGroupsSimulation` where relevant) defaulting to `"picks"`; select caption text, empty-state copy, and i18n namespace from it.
- [x] 2.2 Keep existing call sites (`my-picks/page.tsx`, `matches/[matchId]/page.tsx`) behavior unchanged by relying on the default; verify typecheck passes with no call-site edits required.

## 3. i18n strings

- [x] 3.1 Add a `groupStandings` namespace to `messages/en.json` (page eyebrow/heading/lede, table caption "from results", group heading, column labels reuse or mirror `groupSimulation`, empty states for "no results yet" and "no group stage").
- [x] 3.2 Translate the `groupStandings` namespace in `messages/es.json`, `messages/fr.json`, `messages/de.json`.

## 4. Public standings page

- [x] 4.1 Create `app/[locale]/(public)/standings/page.tsx` (server component): set request locale, call the loader, render all groups via the generalized table with `source="results"`; render the no-group-stage empty state when the loader returns nothing. Read the relevant Next.js guide in `node_modules/next/dist/docs/` before writing route code.
- [x] 4.2 Call `maybeScheduleOpportunisticSync` with the loaded match rows so visiting the page can refresh stale results.
- [x] 4.3 Add `generateMetadata` (title/description + canonical `/standings`, OpenGraph) consistent with `/matches`.
- [x] 4.4 Add `app/[locale]/(public)/standings/loading.tsx` mirroring existing skeleton conventions.

## 5. Navigation

- [x] 5.1 Add a Standings nav entry to `components/site-nav.tsx` / `site-nav-client.tsx` linking to `/standings` (localized via `localePath`), with an appropriate label key.

## 6. Verification

- [x] 6.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`; fix any failures.
- [x] 6.2 Manually verify `/standings` renders for the active competition (pre-tournament empty/seeded state, mid-stage partial table), is reachable from nav, works anonymously, and renders under each locale.
