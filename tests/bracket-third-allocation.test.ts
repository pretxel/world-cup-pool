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
});
