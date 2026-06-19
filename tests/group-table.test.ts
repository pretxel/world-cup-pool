import { describe, expect, it } from "vitest";
import { buildGroupTables, type GroupTableMatch } from "@/lib/group-standings";

// A group-stage match builder. `score` of [h, a] makes it a final with that
// result; omit it for a not-yet-played fixture (status configurable).
function m(
  id: string,
  home: string,
  away: string,
  opts: {
    group?: string;
    status?: string;
    score?: [number, number] | null;
  } = {},
): GroupTableMatch {
  const { group = "A", status, score = null } = opts;
  return {
    id,
    home_team: home,
    away_team: away,
    group_code: group,
    kickoff_at: "2026-06-11T19:00:00Z",
    status: status ?? (score ? "final" : "scheduled"),
    home_score: score ? score[0] : null,
    away_score: score ? score[1] : null,
  };
}

function row(groups: ReturnType<typeof buildGroupTables>, team: string) {
  for (const g of groups) {
    const found = g.rows.find((r) => r.team === team);
    if (found) return found;
  }
  return undefined;
}

describe("buildGroupTables — only final results count", () => {
  it("counts a final result for both teams", () => {
    const groups = buildGroupTables([m("m1", "Brazil", "Serbia", { score: [2, 0] })]);
    expect(row(groups, "Brazil")).toMatchObject({
      played: 1,
      won: 1,
      goalsFor: 2,
      goalsAgainst: 0,
      points: 3,
    });
    expect(row(groups, "Serbia")).toMatchObject({
      played: 1,
      lost: 1,
      goalsFor: 0,
      goalsAgainst: 2,
      points: 0,
    });
  });

  it("ignores scheduled, live, and cancelled matches", () => {
    const groups = buildGroupTables([
      m("m1", "Brazil", "Serbia", { status: "scheduled" }),
      m("m2", "Brazil", "Switzerland", { status: "live", score: [1, 0] }),
      m("m3", "Brazil", "Cameroon", { status: "cancelled" }),
    ]);
    // Brazil is seeded but has played nothing — no status above is `final`.
    expect(row(groups, "Brazil")).toMatchObject({ played: 0, points: 0 });
  });

  it("skips a final with a missing score", () => {
    const groups = buildGroupTables([
      { ...m("m1", "Brazil", "Serbia"), status: "final" }, // scores null
    ]);
    expect(row(groups, "Brazil")).toMatchObject({ played: 0, points: 0 });
  });
});

describe("buildGroupTables — seeding and partial stage", () => {
  it("seeds every team at played=0 before any result", () => {
    const groups = buildGroupTables([
      m("m1", "Brazil", "Serbia"),
      m("m2", "Switzerland", "Cameroon"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(4);
    for (const r of groups[0].rows) {
      expect(r).toMatchObject({ played: 0, points: 0 });
    }
  });

  it("reflects only completed matches mid-stage", () => {
    const groups = buildGroupTables([
      m("m1", "Brazil", "Serbia", { score: [2, 0] }),
      m("m2", "Switzerland", "Cameroon"), // not played
    ]);
    expect(row(groups, "Brazil")).toMatchObject({ played: 1, points: 3 });
    expect(row(groups, "Switzerland")).toMatchObject({ played: 0, points: 0 });
  });
});

describe("buildGroupTables — ordering (points → GD → GF → name)", () => {
  it("orders by points, then goal difference, then goals for, then name", () => {
    // Group A, all three pairings finalised for a 3-team mini-table plus a 4th.
    const groups = buildGroupTables([
      m("m1", "Alpha", "Delta", { score: [1, 0] }), // Alpha +1
      m("m2", "Bravo", "Delta", { score: [3, 0] }), // Bravo +3
      m("m3", "Charlie", "Delta", { score: [1, 0] }), // Charlie +1
      // Alpha vs Charlie both have 3 pts; break by GF: give Charlie more goals.
      m("m4", "Charlie", "Alpha", { score: [0, 0] }), // draw: both +1 pt
    ]);
    const order = groups[0].rows.map((r) => r.team);
    // Bravo: 3 pts. Charlie & Alpha: 4 pts each (win + draw). Delta: 0.
    // Charlie GF=1 GA=0 (GD+1); Alpha GF=1 GA=0 (GD+1); tie on GD & GF →
    // name asc puts Alpha before Charlie.
    expect(order[0]).toBe("Alpha");
    expect(order[1]).toBe("Charlie");
    expect(order[2]).toBe("Bravo");
    expect(order[3]).toBe("Delta");
    expect(groups[0].rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("groups distinct group codes separately, A→Z", () => {
    const groups = buildGroupTables([
      m("b1", "Spain", "Japan", { group: "B", score: [1, 0] }),
      m("a1", "Brazil", "Serbia", { group: "A", score: [2, 0] }),
    ]);
    expect(groups.map((g) => g.groupCode)).toEqual(["A", "B"]);
  });
});
