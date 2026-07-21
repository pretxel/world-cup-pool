## Context

The app supports multiple competitions via a generic `competitions` table with per-competition `format_config`, `providers`, and `branding` JSONB columns. World Cup 2026 is the only seeded competition today. The sync system already supports football-data.org (primary) and ESPN (fallback) as generic providers driven by per-competition config.

Existing specs already define:
- `competition-format`: stages with `kind: "group" | "knockout" | "league"`, `groups.enabled` toggle, per-stage labels
- `group-standings`: handles competitions without group stage (empty state) but has no league table rendering
- `scoring`: hardcoded stage multipliers in both TS and SQL
- `competition-management`: admin CRUD for competitions with provider config fields

Liga MX (Apertura 2026) introduces a format not yet exercised: a league (single table, 18 teams) feeding into a seeded knockout (liguilla) with two-legged aggregate ties.

## Goals / Non-Goals

**Goals:**
- Seed a `liga-mx-apertura-2026` competition with correct format config, providers, teams, and fixture schedule
- Make existing views (matches, leaderboard, bracket, standings) handle the league + knockout format
- Add a league standings table view on the `/standings` page for competitions with a `league`-kind stage
- Support two-legged aggregate ties in the knockout bracket (liguilla format)
- Enable the sync system to pull Liga MX results from football-data.org (`LMX`) and ESPN (`mex.liga`)

**Non-Goals:**
- Competition switcher UI for users (picking which competition to view) — the app continues to show only the active competition
- Multi-tournament Championship (Apertura + Clausura aggregate) — each tournament is a separate competition
- Competition-specific scoring rule variants (Liga MX awards 3/1/0 like World Cup) — only multiplier changes per stage
- Live push notifications specific to Liga MX matches — existing notification system is already generic

## Decisions

### 1. Model each short tournament as a separate competition

Each Liga MX short tournament (Apertura 2026, Clausura 2027, etc.) is a separate `competitions` row. This avoids complexity around mid-season transition and maps cleanly to the existing "single active competition" invariant.

**Alternatives considered:** One competition spanning Apertura + Clausura with season split stages. Rejected because it would require changing the tournament dates halfway through and the active competition would span too long.

### 2. Provider sync uses existing football-data.org + ESPN with Liga MX config

football-data.org supports competition code `LMX` for Liga MX. ESPN league path `mex.liga` covers the same. No new provider implementation needed — just add the correct config values to the seeded competition row and add team name aliases for Liga MX clubs.

### 3. League standings computed via a new `buildLeagueTable()` function

A new pure function alongside `buildGroupTables()` in `lib/group-standings.ts` that takes matches and returns a single `SimulatedGroup` with `groupCode: null`. Sorted by points → GD → GF → team name (same tiebreaker order as groups). Rendered by a new `LeagueStandingsTable` component on the `/standings` page when the active competition has a `league`-kind stage.

**Alternatives considered:** Generalizing `buildGroupTables` to accept a `groupBy` parameter. Rejected — the league case is fundamentally different (no group partition, all teams in one table).

### 4. Two-legged tie support for liguilla matches

Add `tie_key` and `leg` columns to the `matches` table. `tie_key` groups home-and-away pairs (e.g., "qf-1" for quarter-final pairing 1), `leg` is `1` or `2`. The bracket resolver aggregates both legs to determine the winner. This is a minimal schema addition (nullable columns) that doesn't affect World Cup matches (which have NULL tie_key/leg).

### 5. Stage multiplier stored in `format_config.stages[].pointMultiplier`

Add an optional `pointMultiplier` field to `stageSchema`. Both `lib/scoring.ts` and the SQL `compute_match_scores` function resolve from it when present, falling back to the current hardcoded values when absent.

## Risks / Trade-offs

- **Provider data quality**: football-data.org's free tier may not cover Liga MX with the same depth as World Cup. ESPN is keyless and more reliable for this league. Mitigation: ESPN is already the fallback provider — the sync chain handles primary failure gracefully.
- **Two-legged bracket complexity**: The current bracket resolver assumes single-leg knockout. Adding aggregate tie resolution adds complexity to `bracket-core.ts`. Mitigation: scope to minimal changes — only support the liguilla layout (QF → SF → Final) with two-legged ties, don't generalize to all possible bracket formats.
- **Team name aliasing**: Liga MX club names from providers may differ from our seed names (e.g., "Club América" vs "America", "Tigres UANL" vs "Tigres"). Mitigation: add aliases in `team-name-aliases.ts` ahead of seeding.
- **Seed vs sync-first**: Seeding all 153+ Liga MX fixtures is labor-intensive. Mitigation: seed only the teams and competition record; rely on the sync system to populate fixtures from providers. Add a manual admin "sync now" button if needed.
