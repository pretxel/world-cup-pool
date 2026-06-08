import { describe, expect, it } from "vitest";
import {
  groupFixturesByCode,
  simulateAllGroups,
  simulateGroup,
  type GroupStageFixture,
  type PredictedScore,
} from "@/lib/group-standings";

// Small builders so each test reads as "these fixtures + these picks".
function fx(id: string, home: string, away: string): GroupStageFixture {
  return { id, home_team: home, away_team: away, group_code: "A" };
}
function picks(
  entries: [string, number, number][],
): Map<string, PredictedScore> {
  return new Map(
    entries.map(([id, home_goals, away_goals]) => [id, { home_goals, away_goals }]),
  );
}

describe("simulateGroup — points and goal aggregation", () => {
  it("awards 3/1/0 — one win, one draw, one loss => 4 points", () => {
    // Mexico: beats RSA (2-0), draws FRA (1-1), loses to BRA (0-2).
    const fixtures = [
      fx("m1", "Mexico", "South Africa"),
      fx("m2", "Mexico", "France"),
      fx("m3", "Brazil", "Mexico"),
    ];
    const rows = simulateGroup(
      fixtures,
      picks([
        ["m1", 2, 0],
        ["m2", 1, 1],
        ["m3", 2, 0],
      ]),
    );
    const mex = rows.find((r) => r.team === "Mexico")!;
    expect(mex).toMatchObject({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      points: 4,
    });
  });

  it("aggregates goals for/against and goal difference", () => {
    // One team's three scorelines: 2-1, 0-0, 1-3 => GF 3, GA 4, GD -1.
    const fixtures = [
      fx("m1", "Mexico", "South Africa"),
      fx("m2", "Mexico", "France"),
      fx("m3", "Mexico", "Brazil"),
    ];
    const rows = simulateGroup(
      fixtures,
      picks([
        ["m1", 2, 1],
        ["m2", 0, 0],
        ["m3", 1, 3],
      ]),
    );
    const mex = rows.find((r) => r.team === "Mexico")!;
    expect(mex.goalsFor).toBe(3);
    expect(mex.goalsAgainst).toBe(4);
    expect(mex.goalDiff).toBe(-1);
  });

  it("updates both teams of a single predicted match (home win => away loss)", () => {
    const rows = simulateGroup(
      [fx("m1", "Mexico", "South Africa")],
      picks([["m1", 2, 1]]),
    );
    const home = rows.find((r) => r.team === "Mexico")!;
    const away = rows.find((r) => r.team === "South Africa")!;
    expect(home).toMatchObject({
      won: 1,
      lost: 0,
      points: 3,
      goalsFor: 2,
      goalsAgainst: 1,
      goalDiff: 1,
    });
    expect(away).toMatchObject({
      won: 0,
      lost: 1,
      points: 0,
      goalsFor: 1,
      goalsAgainst: 2,
      goalDiff: -1,
    });
  });
});

describe("simulateGroup — tie-break ladder", () => {
  it("points decide first", () => {
    // A beats B and C; D loses both => A on top, D bottom.
    const rows = simulateGroup(
      [
        fx("m1", "Alpha", "Bravo"),
        fx("m2", "Alpha", "Charlie"),
      ],
      picks([
        ["m1", 1, 0],
        ["m2", 1, 0],
      ]),
    );
    expect(rows[0].team).toBe("Alpha");
    expect(rows[0].points).toBe(6);
  });

  it("goal difference breaks a points tie", () => {
    // Both winners by 1 win each, equal points; Alpha +3, Bravo +1.
    const rows = simulateGroup(
      [
        fx("m1", "Alpha", "Xray"),
        fx("m2", "Bravo", "Yankee"),
      ],
      picks([
        ["m1", 3, 0],
        ["m2", 1, 0],
      ]),
    );
    const alpha = rows.findIndex((r) => r.team === "Alpha");
    const bravo = rows.findIndex((r) => r.team === "Bravo");
    expect(alpha).toBeLessThan(bravo);
  });

  it("goals for breaks a points-and-GD tie", () => {
    // Both win by 2-goal margin (equal points, equal GD); Alpha 4-2, Bravo 2-0.
    const rows = simulateGroup(
      [
        fx("m1", "Alpha", "Xray"),
        fx("m2", "Bravo", "Yankee"),
      ],
      picks([
        ["m1", 4, 2],
        ["m2", 2, 0],
      ]),
    );
    const alpha = rows.findIndex((r) => r.team === "Alpha");
    const bravo = rows.findIndex((r) => r.team === "Bravo");
    expect(alpha).toBeLessThan(bravo);
  });

  it("team name (A–Z) breaks a fully equal tie", () => {
    // Zulu vs Alpha draw 0-0: identical stats => Alpha ranks first by name.
    const rows = simulateGroup(
      [fx("m1", "Zulu", "Alpha")],
      picks([["m1", 0, 0]]),
    );
    expect(rows[0].team).toBe("Alpha");
    expect(rows[1].team).toBe("Zulu");
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(2);
  });
});

describe("simulateGroup — unpredicted matches are skipped", () => {
  it("counts only predicted fixtures; played reflects picks", () => {
    const fixtures = [
      fx("m1", "Mexico", "South Africa"), // predicted
      fx("m2", "Mexico", "France"), // not predicted
      fx("m3", "Brazil", "South Africa"), // not predicted
    ];
    const rows = simulateGroup(fixtures, picks([["m1", 1, 0]]));
    const mex = rows.find((r) => r.team === "Mexico")!;
    const rsa = rows.find((r) => r.team === "South Africa")!;
    const bra = rows.find((r) => r.team === "Brazil")!;
    expect(mex.played).toBe(1);
    expect(mex.points).toBe(3);
    expect(rsa.played).toBe(1); // only m1 counts for RSA
    expect(bra.played).toBe(0); // its only fixture (m3) was not predicted
    expect(bra.points).toBe(0);
  });

  it("zero predictions => all teams present at played 0 / points 0", () => {
    const fixtures = [
      fx("m1", "Mexico", "South Africa"),
      fx("m2", "Brazil", "France"),
    ];
    const rows = simulateGroup(fixtures, picks([]));
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });
});

describe("groupFixturesByCode / simulateAllGroups", () => {
  it("buckets by group_code in A→Z order and drops null codes", () => {
    const fixtures: GroupStageFixture[] = [
      { id: "b1", home_team: "B1", away_team: "B2", group_code: "B" },
      { id: "a1", home_team: "A1", away_team: "A2", group_code: "A" },
      { id: "x1", home_team: "X1", away_team: "X2", group_code: null },
    ];
    const buckets = groupFixturesByCode(fixtures);
    expect(buckets.map((b) => b.groupCode)).toEqual(["A", "B"]);
  });

  it("simulates every group from one shared predictions map", () => {
    const fixtures: GroupStageFixture[] = [
      { id: "a1", home_team: "A1", away_team: "A2", group_code: "A" },
      { id: "b1", home_team: "B1", away_team: "B2", group_code: "B" },
    ];
    const groups = simulateAllGroups(fixtures, picks([["a1", 2, 0]]));
    expect(groups).toHaveLength(2);
    const groupA = groups.find((g) => g.groupCode === "A")!;
    expect(groupA.rows[0].team).toBe("A1");
    expect(groupA.rows[0].points).toBe(3);
    const groupB = groups.find((g) => g.groupCode === "B")!;
    expect(groupB.rows.every((r) => r.played === 0)).toBe(true);
  });
});
