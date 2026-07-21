// Pure, DB-free engine that builds a personal "what if my picks came true"
// group table from a user's predicted group-stage scorelines. Mirrors the
// shape of lib/scoring.ts: no Supabase, fully unit-testable.
//
// These are standard football points (3 win / 1 draw / 0 loss) — deliberately
// NOT the prediction-accuracy points in lib/scoring.ts. The two are kept apart
// so the hypothetical standings never conflate with competitive scoring.

export interface GroupFixture {
  id: string;
  home_team: string;
  away_team: string;
}

export interface GroupStageFixture extends GroupFixture {
  group_code: string | null;
}

export interface PredictedScore {
  home_goals: number;
  away_goals: number;
}

export interface GroupTeamRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  rank: number;
}

export interface SimulatedGroup {
  groupCode: string;
  rows: GroupTeamRow[];
}

const WIN_POINTS = 3;
const DRAW_POINTS = 1;

// Ordering: points desc → goal difference desc → goals for desc → team name
// asc (case-insensitive). The name tier guarantees a stable, deterministic
// order even when two teams are otherwise level.
export function compareTeamRows(a: GroupTeamRow, b: GroupTeamRow): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.team.localeCompare(b.team, undefined, { sensitivity: "base" });
}

// Build one group's standings from its fixtures and the user's predictions.
// Only fixtures present in `predictionsByMatchId` count; unpredicted fixtures
// contribute nothing, so `played` reflects how many of a team's group games the
// user has picked (0–3). Every team named in `fixtures` is seeded, so all four
// appear even at played = 0 (the empty-group case).
export function simulateGroup(
  fixtures: GroupFixture[],
  predictionsByMatchId: Map<string, PredictedScore>,
): GroupTeamRow[] {
  const rows = new Map<string, GroupTeamRow>();

  const seed = (team: string): GroupTeamRow => {
    let row = rows.get(team);
    if (!row) {
      row = {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        rank: 0,
      };
      rows.set(team, row);
    }
    return row;
  };

  for (const fx of fixtures) {
    const home = seed(fx.home_team);
    const away = seed(fx.away_team);

    const pick = predictionsByMatchId.get(fx.id);
    if (!pick) continue;

    const hg = pick.home_goals;
    const ag = pick.away_goals;

    home.played += 1;
    away.played += 1;
    home.goalsFor += hg;
    home.goalsAgainst += ag;
    away.goalsFor += ag;
    away.goalsAgainst += hg;

    if (hg > ag) {
      home.won += 1;
      home.points += WIN_POINTS;
      away.lost += 1;
    } else if (hg < ag) {
      away.won += 1;
      away.points += WIN_POINTS;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += DRAW_POINTS;
      away.points += DRAW_POINTS;
    }
  }

  const ordered = [...rows.values()];
  for (const row of ordered) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
  }

  ordered.sort(compareTeamRows);
  ordered.forEach((row, i) => {
    row.rank = i + 1;
  });

  return ordered;
}

// Bucket group-stage fixtures by `group_code`, dropping any without one.
// Groups come back in A→Z code order for predictable rendering.
export function groupFixturesByCode(
  fixtures: GroupStageFixture[],
): { groupCode: string; fixtures: GroupFixture[] }[] {
  const byCode = new Map<string, GroupFixture[]>();
  for (const fx of fixtures) {
    if (!fx.group_code) continue;
    const arr = byCode.get(fx.group_code) ?? [];
    arr.push({ id: fx.id, home_team: fx.home_team, away_team: fx.away_team });
    byCode.set(fx.group_code, arr);
  }
  return [...byCode.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((groupCode) => ({ groupCode, fixtures: byCode.get(groupCode)! }));
}

// All twelve simulated group tables, A→L, from one predictions map.
export function simulateAllGroups(
  fixtures: GroupStageFixture[],
  predictionsByMatchId: Map<string, PredictedScore>,
): SimulatedGroup[] {
  return groupFixturesByCode(fixtures).map(({ groupCode, fixtures }) => ({
    groupCode,
    rows: simulateGroup(fixtures, predictionsByMatchId),
  }));
}

// One group-stage match as the *real* standings need it: the four fields the
// staleness scan reads (so the page can opportunistically resync — structurally
// a `StalenessShape`) plus the id, group code, and actual scores the table is
// built from. Kept here in the pure engine so it stays DB-free and testable.
export interface GroupTableMatch {
  id: string;
  home_team: string;
  away_team: string;
  group_code: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  kickoff_at: string;
}

// Build the real group tables from actual match results. Counts a match toward
// the table only when it is `final` with both scores recorded; every other
// status (and a final with a missing score) contributes nothing, so points
// reflect completed games only. Every team named in a fixture is still seeded,
// so all four appear even before any result. Pure — same 3/1/0 engine as the
// predictions path, just fed real scorelines.
export function buildGroupTables(
  matches: GroupTableMatch[],
): SimulatedGroup[] {
  const fixtures: GroupStageFixture[] = matches.map((m) => ({
    id: m.id,
    home_team: m.home_team,
    away_team: m.away_team,
    group_code: m.group_code,
  }));

  const resultsByMatchId = new Map<string, PredictedScore>();
  for (const m of matches) {
    if (m.status !== "final") continue;
    if (m.home_score == null || m.away_score == null) continue;
    resultsByMatchId.set(m.id, {
      home_goals: m.home_score,
      away_goals: m.away_score,
    });
  }

  return simulateAllGroups(fixtures, resultsByMatchId);
}

// Tiebreaker method for league standings.
export type Tiebreaker = "gd" | "h2h";

// Reorder a list of team rows that share the same points total using
// head-to-head results. `matches` must be the same source the rows were
// derived from (only `final` matches with scores are considered). Returns a
// new array of the same length — the final ordering uses H2H points → H2H GD
// → H2H GF → overall GD → overall GF → team name, so the fallback chain
// eventually produces a stable result even when H2H is fully symmetric.
function resolveH2HTie(
  tied: GroupTeamRow[],
  matches: GroupTableMatch[],
): GroupTeamRow[] {
  const teamSet = new Set(tied.map((r) => r.team));
  const h2hPoints = new Map<string, number>();
  const h2hGd = new Map<string, number>();
  const h2hGf = new Map<string, number>();

  for (const row of tied) {
    h2hPoints.set(row.team, 0);
    h2hGd.set(row.team, 0);
    h2hGf.set(row.team, 0);
  }

  for (const m of matches) {
    if (m.status !== "final") continue;
    if (m.home_score == null || m.away_score == null) continue;
    if (!teamSet.has(m.home_team) || !teamSet.has(m.away_team)) continue;

    const homePts = h2hPoints.get(m.home_team)!;
    const awayPts = h2hPoints.get(m.away_team)!;
    const homeGd = h2hGd.get(m.home_team)!;
    const awayGd = h2hGd.get(m.away_team)!;
    const homeGf = h2hGf.get(m.home_team)!;
    const awayGf = h2hGf.get(m.away_team)!;

    h2hGf.set(m.home_team, homeGf + m.home_score);
    h2hGf.set(m.away_team, awayGf + m.away_score);
    h2hGd.set(m.home_team, homeGd + (m.home_score - m.away_score));
    h2hGd.set(m.away_team, awayGd + (m.away_score - m.home_score));

    if (m.home_score > m.away_score) {
      h2hPoints.set(m.home_team, homePts + WIN_POINTS);
    } else if (m.home_score < m.away_score) {
      h2hPoints.set(m.away_team, awayPts + WIN_POINTS);
    } else {
      h2hPoints.set(m.home_team, homePts + DRAW_POINTS);
      h2hPoints.set(m.away_team, awayPts + DRAW_POINTS);
    }
  }

  return [...tied].sort((a, b) => {
    const h2hA = h2hPoints.get(a.team) ?? 0;
    const h2hB = h2hPoints.get(b.team) ?? 0;
    if (h2hB !== h2hA) return h2hB - h2hA;
    const gdA = h2hGd.get(a.team) ?? 0;
    const gdB = h2hGd.get(b.team) ?? 0;
    if (gdB !== gdA) return gdB - gdA;
    const gfA = h2hGf.get(a.team) ?? 0;
    const gfB = h2hGf.get(b.team) ?? 0;
    if (gfB !== gfA) return gfB - gfA;
    // Fall through to overall tiebreakers
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.localeCompare(b.team, undefined, { sensitivity: "base" });
  });
}

// Build a single league table from actual match results. Uses the same 3/1/0
// points engine as the group standings, but returns one SimulatedGroup with a
// null groupCode. Every team named in a fixture is seeded so all 18 appear even
// before any result. Counts only `final` matches with recorded scores.
// When `tiebreaker` is `"h2h"`, tied teams are reordered by head-to-head
// results before the standard fallback chain.
export function buildLeagueTable(
  matches: GroupTableMatch[],
  tiebreaker: Tiebreaker = "gd",
): SimulatedGroup {
  const fixtures: GroupFixture[] = matches.map((m) => ({
    id: m.id,
    home_team: m.home_team,
    away_team: m.away_team,
  }));

  const resultsByMatchId = new Map<string, PredictedScore>();
  for (const m of matches) {
    if (m.status !== "final") continue;
    if (m.home_score == null || m.away_score == null) continue;
    resultsByMatchId.set(m.id, {
      home_goals: m.home_score,
      away_goals: m.away_score,
    });
  }

  const rows = simulateGroup(fixtures, resultsByMatchId);

  if (tiebreaker === "h2h") {
    // Group by points, apply H2H within each tied group.
    const byPoints = new Map<number, GroupTeamRow[]>();
    for (const row of rows) {
      const arr = byPoints.get(row.points) ?? [];
      arr.push(row);
      byPoints.set(row.points, arr);
    }

    const reordered: GroupTeamRow[] = [];
    for (const pts of [...byPoints.keys()].sort((a, b) => b - a)) {
      const group = byPoints.get(pts)!;
      if (group.length > 1) {
        reordered.push(...resolveH2HTie(group, matches));
      } else {
        reordered.push(group[0]);
      }
    }

    reordered.forEach((row, i) => {
      row.rank = i + 1;
    });

    return { groupCode: "", rows: reordered };
  }

  return { groupCode: "", rows };
}
