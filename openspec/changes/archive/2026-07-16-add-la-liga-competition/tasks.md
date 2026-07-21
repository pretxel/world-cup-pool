## 1. Seed Migration & Provider Config

- [x] 1.1 Create migration `la_liga_seed.sql` with: competition row for `la-liga-2026-2027`, format config (single league stage `"regular"` with `pointMultiplier: 1`), providers config (football-data: `PD`, ESPN: `esp.1`), and branding config (`LALIGA` brand code, `La Liga 2026-27 Pool` email from name)
- [x] 1.2 Add La Liga team name aliases to `lib/team-name-aliases.ts` (20 clubs, covering football-data.org and ESPN naming conventions)

## 2. Head-to-Head Tiebreaker

- [x] 2.1 Add optional `tiebreaker: "h2h" | "gd"` parameter to `buildLeagueTable()` in `lib/group-standings.ts` (default `"gd"` for backward compatibility)
- [x] 2.2 Implement H2H resolution: when `tiebreaker: "h2h"` is set and two or more teams are level on points, reorder them by their head-to-head results (points earned in matches between the tied teams), falling back to GD → GF → team name when H2H is also level
- [x] 2.3 Wire H2H tiebreaker into `getLeagueTable()` by reading a `tiebreaker` value from the competition's format config (or defaulting to `"gd"`)

## 3. Verification

- [x] 3.1 Run existing test suite to confirm no regressions from H2H tiebreaker changes
- [x] 3.2 Verify league standings render correctly for a single-stage league with no knockout rounds
- [x] 3.3 Verify bracket page shows graceful empty state for knockout-less competition
- [ ] 3.4 Verify La Liga seeding migration is idempotent (can re-run without errors)

## 4. Follow-up

- [ ] 4.1 After deploy: activate La Liga competition and verify sync pulls fixtures from providers
- [ ] 4.2 After first La Liga match results: verify scoring, standings, and leaderboard compute correctly
