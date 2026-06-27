import { describe, expect, it } from "vitest";
import {
  assignMatchNumbers,
  buildBracket,
  parseKnockoutSlot,
  type BracketMatchInput,
} from "@/lib/bracket-core";

let seq = 0;
function mk(
  stage: string,
  home: string,
  away: string,
  opts: {
    group?: string | null;
    kickoff?: string;
    score?: [number, number] | null;
    status?: string;
    id?: string;
    venue?: string | null;
  } = {},
): BracketMatchInput {
  const {
    group = stage === "group" ? "A" : null,
    kickoff,
    score = null,
    status,
    id,
    venue = null,
  } = opts;
  return {
    id: id ?? `m${seq++}`,
    stage,
    group_code: group,
    home_team: home,
    away_team: away,
    kickoff_at: kickoff ?? "2026-06-11T19:00:00Z",
    status: status ?? (score ? "final" : "scheduled"),
    home_score: score ? score[0] : null,
    away_score: score ? score[1] : null,
    venue,
  };
}

function find(bracket: ReturnType<typeof buildBracket>, stage: string, idx = 0) {
  return bracket.rounds.find((r) => r.stage === stage)!.matches[idx];
}

describe("parseKnockoutSlot", () => {
  it("parses every placeholder shape", () => {
    expect(parseKnockoutSlot("Winner Group C")).toEqual({ kind: "winner-group", group: "C" });
    expect(parseKnockoutSlot("2nd Group F")).toEqual({ kind: "runner-group", group: "F" });
    expect(parseKnockoutSlot("3rd Group A/B/C/D/F")).toEqual({
      kind: "third",
      candidates: ["A", "B", "C", "D", "F"],
    });
    expect(parseKnockoutSlot("Winner Match 73")).toEqual({ kind: "winner-match", matchNumber: 73 });
    expect(parseKnockoutSlot("Loser Match 101")).toEqual({ kind: "loser-match", matchNumber: 101 });
    expect(parseKnockoutSlot("Brazil")).toEqual({ kind: "literal", text: "Brazil" });
  });
});

describe("assignMatchNumbers", () => {
  it("numbers by stage range, not raw date (group/r32 overlap)", () => {
    const g1 = mk("group", "Mexico", "South Africa", { kickoff: "2026-06-28T19:00:00Z" }); // late group
    const g2 = mk("group", "Brazil", "Serbia", { kickoff: "2026-06-11T19:00:00Z" });
    const k1 = mk("r32", "Winner Group A", "2nd Group B", { kickoff: "2026-06-28T15:00:00Z" }); // early r32
    const fin = mk("final", "Winner Match 101", "Winner Match 102", { kickoff: "2026-07-19T19:00:00Z" });
    const { numberById } = assignMatchNumbers([g1, g2, k1, fin]);
    // group sorted by kickoff: g2(early)=1, g1(late)=2 — both < 73 despite g1's date
    expect(numberById.get(g2.id)).toBe(1);
    expect(numberById.get(g1.id)).toBe(2);
    expect(numberById.get(k1.id)).toBe(73);
    expect(numberById.get(fin.id)).toBe(104);
  });
});

describe("buildBracket — group-slot projection", () => {
  it("confirms winner/runner once the group is complete", () => {
    // Single group-A final → finals==total → complete.
    const g = mk("group", "Mexico", "South Africa", { score: [2, 0] });
    const r32 = mk("r32", "Winner Group A", "2nd Group A");
    const b = buildBracket([g, r32]);
    const m = find(b, "r32");
    expect(m.home).toMatchObject({ team: "Mexico", status: "confirmed" });
    expect(m.away).toMatchObject({ team: "South Africa", status: "confirmed" });
  });

  it("marks projection provisional while the group is unfinished", () => {
    const g1 = mk("group", "Mexico", "South Africa", { score: [2, 0] });
    const g2 = mk("group", "Mexico", "France"); // scheduled → group incomplete
    const r32 = mk("r32", "Winner Group A", "2nd Group B");
    const b = buildBracket([g1, g2, r32]);
    expect(find(b, "r32").home).toMatchObject({ team: "Mexico", status: "provisional" });
  });

  it("leaves a group with no results as a placeholder", () => {
    const g = mk("group", "Mexico", "South Africa"); // scheduled
    const r32 = mk("r32", "Winner Group A", "2nd Group A");
    const b = buildBracket([g, r32]);
    const m = find(b, "r32");
    expect(m.home).toMatchObject({ team: null, label: "Winner Group A", status: "placeholder" });
  });
});

describe("buildBracket — later rounds from recorded results", () => {
  it("resolves Winner/Loser Match NN from a decisive final, else placeholder", () => {
    const r32 = mk("r32", "Brazil", "Serbia", { score: [2, 1] }); // becomes match 73
    const r16 = mk("r16", "Winner Match 73", "Winner Match 74", {
      kickoff: "2026-07-04T19:00:00Z",
    });
    const b = buildBracket([r32, r16]);
    const m = find(b, "r16");
    expect(m.home).toMatchObject({ team: "Brazil", status: "confirmed" });
    // match 74 doesn't exist → unresolved
    expect(m.away).toMatchObject({ team: null, label: "Winner Match 74", status: "placeholder" });
  });

  it("keeps slot unresolved when the source match is a draw / not final", () => {
    const r32 = mk("r32", "Brazil", "Serbia", { score: [1, 1] }); // drawn → undecided
    const r16 = mk("r16", "Winner Match 73", "Loser Match 73", {
      kickoff: "2026-07-04T19:00:00Z",
    });
    const b = buildBracket([r32, r16]);
    const m = find(b, "r16");
    expect(m.home.team).toBeNull();
    expect(m.away.team).toBeNull();
  });
});

describe("buildBracket — structure", () => {
  it("returns empty when there are no knockout fixtures", () => {
    const b = buildBracket([mk("group", "Mexico", "South Africa", { score: [1, 0] })]);
    expect(b.hasKnockout).toBe(false);
    expect(b.rounds).toEqual([]);
  });

  it("orders rounds r32→final and resolves literal real teams", () => {
    const r32 = mk("r32", "Brazil", "Serbia", { kickoff: "2026-06-28T19:00:00Z" });
    const fin = mk("final", "Spain", "France", { kickoff: "2026-07-19T19:00:00Z" });
    const b = buildBracket([r32, fin]);
    expect(b.rounds.map((r) => r.stage)).toEqual(["r32", "final"]);
    expect(find(b, "r32").home).toMatchObject({ team: "Brazil", status: "confirmed" });
  });

  it("carries kickoff and venue through to the slot match", () => {
    const withVenue = mk("r32", "Brazil", "Serbia", {
      kickoff: "2026-06-28T19:00:00Z",
      venue: "MetLife Stadium, New York",
      id: "with-venue",
    });
    const noVenue = mk("final", "Spain", "France", {
      kickoff: "2026-07-19T19:00:00Z",
      id: "no-venue",
    });
    const b = buildBracket([withVenue, noVenue]);
    expect(find(b, "r32")).toMatchObject({
      kickoffAt: "2026-06-28T19:00:00Z",
      venue: "MetLife Stadium, New York",
    });
    expect(find(b, "final").venue).toBeNull();
  });
});
