## Context

The app now supports league-format competitions (via the recent Liga MX work). The `competitions` table, provider sync, league standings rendering (`LeagueStandingsTable`, `buildLeagueTable`, `getLeagueTable`), and per-stage `pointMultiplier` scoring are all generic and require no schema changes.

La Liga (2026-2027 season) introduces no new format concepts — it is a pure single-league stage with 20 teams, double round-robin (38 matchdays), no knockout rounds. The main work is seeding the competition row, adding team aliases, and verifying that the existing infrastructure handles a single-stage league with no knockout component.

A subtle difference: La Liga uses head-to-head (H2H) as the primary tiebreaker before goal difference, while the current `buildLeagueTable` uses points → GD → GF → team name. This needs an option for H2H-aware tiebreaking.

## Goals / Non-Goals

**Goals:**
- Seed a `la-liga-2026-2027` competition with correct format config, providers, and team aliases
- Add H2H tiebreaker support to the league standings engine
- Verify all existing views (standings, leaderboard, matches, bracket) handle a single-stage league with no knockout rounds
- Enable sync from football-data.org (`PD`) and ESPN (`esp.1`)

**Non-Goals:**
- Copa del Rey support (separate competition)
- Relegation/promotion tracking (out of scope for a prediction pool)
- Title race / European qualification projections
- Bracket page changes (no knockout rounds → graceful empty state already exists)

## Decisions

### 1. Single-stage format config modeled as `league` only

La Liga has only one stage: a league stage with `kind: "league"` and no groups. The format config is `{ stages: [{ key: "regular", kind: "league", ... }], groups: { enabled: false } }`. This is the simplest possible format and exercises the existing league infrastructure fully.

### 2. Head-to-head tiebreaker added as optional parameter to `buildLeagueTable`

The current `buildLeagueTable` uses the same `compareTeamRows` function as groups (points → GD → GF → team name). La Liga uses H2H between tied teams before GD. Adding an optional `tiebreaker: "h2h" | "gd"` parameter to `buildLeagueTable` (defaulting to `"gd"` for backward compatibility) allows the standings engine to reorder tied teams by their head-to-head results when configured. This is a pure function addition — no schema changes needed.

**Alternatives considered:** Always computing H2H alongside GD. Rejected — it adds unnecessary computation for World Cup / Liga MX where GD is the primary tiebreaker.

### 3. Provider sync uses existing football-data.org `PD` + ESPN `esp.1`

football-data.org uses competition code `PD` for La Liga Primera División. ESPN uses `esp.1`. Both are already supported by the existing provider chain — just configure them in the seeded competition row.

### 4. Season modeled as `la-liga-2026-2027` spanning August–May

Unlike Liga MX (split into Apertura/Clausura), La Liga runs one continuous season. Modeled as a single competition with `season: "2026-2027"` spanning from August 2026 to May 2027.

## Risks / Trade-offs

- **Provider data coverage**: football-data.org free tier may have rate limits for `PD` during busy matchweeks. Mitigation: ESPN is keyless and handles the fallback.
- **H2H tiebreaker complexity**: Computing H2H requires analyzing results between tied teams, which adds complexity to the standings engine. Mitigation: only compute H2H when explicitly configured (opt-in), keeping the default GD path fast and simple.
- **20-team schedule sync**: 380 matches (20 teams × 38 matchdays / 2) may exceed the free tier API limits on initial sync. Mitigation: the sync system already handles per-competition requests; initial seed can rely on a one-time manual CSV import if the API is insufficient.
