## 1. Schema & Format Config

- [x] 1.1 Add `pointMultiplier` field to `stageSchema` in `lib/competition-schema.ts` (optional number, default undefined)
- [x] 1.2 Update `formatConfigSchema` superRefine to validate `pointMultiplier` is positive when present
- [x] 1.3 Add `tie_key` and `leg` nullable columns to `matches` table (new migration)
- [x] 1.4 Update the matches validation trigger to accept `tie_key`/`leg` as valid metadata fields
- [x] 1.5 Update `compute_match_scores` SQL function to resolve stage multiplier from `format_config.stages[].pointMultiplier`, falling back to hardcoded values

## 2. Liga MX Seed Migration

- [x] 2.1 Create migration `ligamx_seed.sql` with: competition row for `liga-mx-apertura-2026`, format config (league stage + qf/sf/final knockout stages with multipliers), providers config (football-data: `LMX`, ESPN: `mex.liga`), and branding config
- [x] 2.2 Add Liga MX team name aliases to `lib/team-name-aliases.ts` (18 clubs, covering both football-data.org and ESPN naming conventions)
- [x] 2.3 Add `normalizeTeamName` coverage for Liga MX-specific name edge cases

## 3. Scoring & Standings Engine

- [x] 3.1 Update `lib/scoring.ts` `scorePrediction()` to resolve multiplier from competition format config when available, falling back to `STAGE_POINT_MULTIPLIER`
- [x] 3.2 Add `buildLeagueTable()` to `lib/group-standings.ts`: single `SimulatedGroup` from all league-stage `final` matches, sorted by points → GD → GF → team name
- [x] 3.3 Add `getLeagueTable()` to `lib/group-table.ts`: queries league-stage matches for active competition and calls `buildLeagueTable()`

## 4. Standings Page & League Table UI

- [x] 4.1 Create `LeagueStandingsTable` component (server component, single sorted table with P/W/D/L/GF/GA/GD/Pts columns)
- [x] 4.2 Update `/standings` page to detect league-format competition and render `LeagueStandingsTable` instead of group grid or empty state
- [x] 4.3 Update `lib/competition-schema.ts` with `leagueStageKey()` helper (returns key of first `league`-kind stage)
- [x] 4.4 Add i18n strings for league standings table headers and labels (en, es, fr)

## 5. Bracket & Liguilla

- [ ] 5.1 Update `lib/bracket-core.ts` to resolve `Seed N` placeholders from league standings
- [ ] 5.2 Add two-legged aggregate tie resolution to bracket resolver (aggregate score over two legs, away goals tiebreaker)
- [ ] 5.3 Update bracket view components to render two-legged ties (leg 1 / leg 2 labels, aggregate score display)
- [x] 5.4 Update `lib/database.types.ts` with new `tie_key`/`leg` columns on `MatchRow`

## 6. Admin Competition Form

- [x] 6.1 Add `pointMultiplier` field to stage editor in `competition-form.tsx`
- [ ] 6.2 Ensure team management tab is available for league-format competitions

## 7. Verification

- [x] 7.1 Run existing test suite to confirm no regressions from `league` stage handling
- [x] 7.2 Verify `STAGE_POINT_MULTIPLIER` fallback works when `pointMultiplier` is undefined (World Cup unchanged)
- [ ] 7.3 Verify Liga MX seeding migration is idempotent (can re-run without errors)

## 8. Follow-up

- [ ] 8.1 After deploy: activate Liga MX competition and verify sync pulls fixtures from providers
- [ ] 8.2 After first Liga MX match results: verify scoring, standings, and leaderboard compute correctly
