import { describe, expect, it } from "vitest";
import {
  allocateBestThirds,
  comboKey,
  THIRD_SLOT_CANDIDATES,
  THIRD_SLOT_WINNERS,
} from "@/lib/bracket-third-allocation";
import { THIRD_PLACE_ALLOCATION } from "@/lib/bracket-third-allocation.generated";
import { buildBracket, type BracketMatchInput } from "@/lib/bracket-core";

describe("third-place allocation table integrity", () => {
  const rows = Object.entries(THIRD_PLACE_ALLOCATION);

  it("has all C(12,8)=495 distinct sorted-key entries", () => {
    expect(rows).toHaveLength(495);
    expect(new Set(rows.map(([k]) => k)).size).toBe(495);
    for (const [k] of rows) {
      expect([...k].join("")).toBe([...k].sort().join("")); // sorted
      expect(new Set(k).size).toBe(8); // 8 distinct groups
    }
  });

  it("every value is a permutation of its key and respects slot candidates", () => {
    for (const [k, v] of rows) {
      expect([...v].sort().join("")).toBe([...k].sort().join(""));
      THIRD_SLOT_WINNERS.forEach((winner, i) => {
        expect(THIRD_SLOT_CANDIDATES[winner]).toContain(v[i]);
      });
    }
  });

  it("matches known Annex C rows", () => {
    expect(allocateBestThirds([..."ABCDEFGH"])).toEqual({
      A: "H", B: "G", D: "B", E: "C", G: "A", I: "F", K: "D", L: "E",
    });
    expect(allocateBestThirds([..."EFGHIJKL"])).toEqual({
      A: "E", B: "J", D: "I", E: "F", G: "H", I: "G", K: "L", L: "K",
    });
  });

  it("returns null for non-8 sets or unknown combos", () => {
    expect(allocateBestThirds([..."ABCDEFG"])).toBeNull();
    expect(comboKey(["C", "A", "B"])).toBe("ABC");
  });
});

// A complete 3-team round-robin group ranked code1 > code2 > code3.
function completeGroup(code: string): BracketMatchInput[] {
  const t = [`${code}1`, `${code}2`, `${code}3`];
  const m = (home: string, away: string, h: number, a: number): BracketMatchInput => ({
    id: `${home}-${away}`,
    stage: "group",
    group_code: code,
    home_team: home,
    away_team: away,
    kickoff_at: "2026-06-15T12:00:00Z",
    status: "final",
    home_score: h,
    away_score: a,
  });
  // 1 beats 2 and 3; 2 beats 3 → ranks 1,2,3; rank3 = code3
  return [m(t[0], t[1], 2, 0), m(t[0], t[2], 2, 0), m(t[1], t[2], 1, 0)];
}

// A group with one result but an unplayed match: ranked code1 > code2 > code3
// (1 beat 3, 2 beat 3; the 1-vs-2 decider is still scheduled). The group has a
// real, results-backed current third (code3) yet is not complete.
function partialGroup(code: string, thirdGoalsConceded = 0): BracketMatchInput[] {
  const t = [`${code}1`, `${code}2`, `${code}3`];
  const m = (
    home: string,
    away: string,
    h: number | null,
    a: number | null,
    status: string,
  ): BracketMatchInput => ({
    id: `${home}-${away}`,
    stage: "group",
    group_code: code,
    home_team: home,
    away_team: away,
    kickoff_at: "2026-06-15T12:00:00Z",
    status,
    home_score: h,
    away_score: a,
  });
  return [
    m(t[0], t[1], null, null, "scheduled"), // decider not played
    m(t[0], t[2], 2, thirdGoalsConceded, "final"),
    m(t[1], t[2], 1, thirdGoalsConceded, "final"),
  ];
}

describe("buildBracket — best-third resolution", () => {
  it("fills a 3rd slot from the official allocation once all groups complete", () => {
    // 8 complete groups A–H → qualifying combo ABCDEFGH → slot A gets group H's 3rd.
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H"].flatMap(completeGroup);
    const r32: BracketMatchInput = {
      id: "ko1",
      stage: "r32",
      group_code: null,
      home_team: "Winner Group A",
      away_team: "3rd Group C/E/F/H/I",
      kickoff_at: "2026-06-28T19:00:00Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    };
    const b = buildBracket([...groups, r32]);
    const m = b.rounds.find((r) => r.stage === "r32")!.matches[0];
    expect(m.home).toMatchObject({ team: "A1", status: "confirmed" });
    expect(m.away).toMatchObject({ team: "H3", status: "confirmed" });
  });

  it("keeps a 3rd slot as a candidate placeholder until all groups complete", () => {
    // One group incomplete → no allocation.
    const groups = [
      ...["A", "B", "C", "D", "E", "F", "G"].flatMap(completeGroup),
      // group H with an unplayed match → incomplete
      {
        id: "H-incomplete",
        stage: "group",
        group_code: "H",
        home_team: "H1",
        away_team: "H2",
        kickoff_at: "2026-06-15T12:00:00Z",
        status: "scheduled",
        home_score: null,
        away_score: null,
      } as BracketMatchInput,
    ];
    const r32: BracketMatchInput = {
      id: "ko1",
      stage: "r32",
      group_code: null,
      home_team: "Winner Group A",
      away_team: "3rd Group C/E/F/H/I",
      kickoff_at: "2026-06-28T19:00:00Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    };
    const b = buildBracket([...groups, r32]);
    const m = b.rounds.find((r) => r.stage === "r32")!.matches[0];
    expect(m.away).toMatchObject({ team: null, label: "3rd Group C/E/F/H/I", status: "placeholder" });
  });

  it("projects a 3rd slot provisionally once every group has a result but is not complete", () => {
    // 8 groups A–H, each with a result but an unplayed decider → same combo
    // ABCDEFGH → slot A gets group H's 3rd, marked provisional (not confirmed).
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H"].flatMap((c) =>
      partialGroup(c),
    );
    const r32: BracketMatchInput = {
      id: "ko1",
      stage: "r32",
      group_code: null,
      home_team: "Winner Group A",
      away_team: "3rd Group C/E/F/H/I",
      kickoff_at: "2026-06-28T19:00:00Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    };
    const b = buildBracket([...groups, r32]);
    const m = b.rounds.find((r) => r.stage === "r32")!.matches[0];
    expect(m.home).toMatchObject({ team: "A1", status: "provisional" });
    expect(m.away).toMatchObject({ team: "H3", status: "provisional" });
  });

  it("keeps 3rd slots as placeholders when at least one group has no result", () => {
    // 7 groups have a result; group H has zero results → not every group is
    // represented, so no ranking is meaningful → placeholder.
    const groups = [
      ...["A", "B", "C", "D", "E", "F", "G"].flatMap((c) => partialGroup(c)),
      {
        id: "H-scheduled",
        stage: "group",
        group_code: "H",
        home_team: "H1",
        away_team: "H2",
        kickoff_at: "2026-06-15T12:00:00Z",
        status: "scheduled",
        home_score: null,
        away_score: null,
      } as BracketMatchInput,
    ];
    const r32: BracketMatchInput = {
      id: "ko1",
      stage: "r32",
      group_code: null,
      home_team: "Winner Group A",
      away_team: "3rd Group C/E/F/H/I",
      kickoff_at: "2026-06-28T19:00:00Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    };
    const b = buildBracket([...groups, r32]);
    const m = b.rounds.find((r) => r.stage === "r32")!.matches[0];
    expect(m.away).toMatchObject({
      team: null,
      label: "3rd Group C/E/F/H/I",
      status: "placeholder",
    });
  });

  it("changes which group fills a slot as standings shift the best-eight set", () => {
    // 9 complete groups A–I. The two weakest thirds (by goals conceded) drop out
    // of the best-8; the resulting combo decides the allocation. The slot for
    // winner E (combo candidates A,B,C,D,F) resolves to whichever of those eight
    // the table assigns.
    const r32: BracketMatchInput = {
      id: "ko1",
      stage: "r32",
      group_code: null,
      home_team: "Winner Group E",
      away_team: "3rd Group A/B/C/D/F",
      kickoff_at: "2026-06-28T19:00:00Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    };

    // Build 9 complete groups, but tune each group's 3rd-place goals conceded so
    // we control which two are the worst (and thus excluded from the best-8).
    const group = (code: string, thirdGC: number): BracketMatchInput[] => {
      const t = [`${code}1`, `${code}2`, `${code}3`];
      const mk = (
        home: string,
        away: string,
        h: number,
        a: number,
      ): BracketMatchInput => ({
        id: `${home}-${away}`,
        stage: "group",
        group_code: code,
        home_team: home,
        away_team: away,
        kickoff_at: "2026-06-15T12:00:00Z",
        status: "final",
        home_score: h,
        away_score: a,
      });
      // 1 beats 2 and 3; 2 beats 3 → ranks 1,2,3. Third loses both games by
      // `thirdGC` goals each — more conceded = weaker third (worse GD).
      return [
        mk(t[0], t[1], 2, 0),
        mk(t[0], t[2], thirdGC, 0),
        mk(t[1], t[2], thirdGC, 0),
      ];
    };

    const codes = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    // Make every third concede 1, except one "weak" group that concedes more and
    // is excluded as the single worst third. With 9 groups the best-8 set is
    // "everyone but the weakest", so the excluded group decides the combo.
    const build = (weak: string) =>
      codes.map((c) => group(c, c === weak ? 6 : 1)).flat();

    // Drop I → best-8 = ABCDEFGH; allocation maps slot E (faces winner E) to C3.
    const ba = buildBracket([...build("I"), r32]);
    const ma = ba.rounds.find((r) => r.stage === "r32")!.matches[0].away;
    // Drop H → best-8 = ABCDEFGI; the same slot now maps to D3.
    const bb = buildBracket([...build("H"), r32]);
    const mb = bb.rounds.find((r) => r.stage === "r32")!.matches[0].away;

    // Both resolve to a real team, confirmed (all groups complete)…
    expect(ma).toMatchObject({ team: "C3", status: "confirmed" });
    expect(mb).toMatchObject({ team: "D3", status: "confirmed" });
    // …a different group's third, because the best-8 set changed.
    expect(ma.team).not.toBe(mb.team);
  });
});
