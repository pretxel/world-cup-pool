import { describe, expect, it } from "vitest";
import { computeKnockoutTeamUpdates } from "@/lib/admin/confirm-knockout-teams";
import type { BracketMatchInput } from "@/lib/bracket-core";

let seq = 0;
function mk(
  stage: string,
  home: string,
  away: string,
  opts: {
    group?: string | null;
    score?: [number, number] | null;
    status?: string;
    kickoff?: string;
    id?: string;
  } = {},
): BracketMatchInput {
  const { group = stage === "group" ? "A" : null, score = null, status, kickoff, id } = opts;
  return {
    id: id ?? `m${seq++}`,
    stage,
    group_code: group,
    home_team: home,
    away_team: away,
    kickoff_at: kickoff ?? "2026-06-28T19:00:00Z",
    status: status ?? (score ? "final" : "scheduled"),
    home_score: score ? score[0] : null,
    away_score: score ? score[1] : null,
    venue: null,
  };
}

// A complete group: 1 beats 2 and 3, 2 beats 3 → ranks code1 > code2 > code3,
// every match final ⇒ the group is complete and its slots resolve CONFIRMED.
function completeGroup(code: string): BracketMatchInput[] {
  const t = [`${code}1`, `${code}2`, `${code}3`];
  return [
    mk("group", t[0], t[1], { group: code, score: [2, 0] }),
    mk("group", t[0], t[2], { group: code, score: [2, 0] }),
    mk("group", t[1], t[2], { group: code, score: [1, 0] }),
  ];
}

// A group with results but an unplayed decider ⇒ has a current rank-1 but is NOT
// complete, so its slots resolve PROVISIONAL.
function partialGroup(code: string): BracketMatchInput[] {
  const t = [`${code}1`, `${code}2`, `${code}3`];
  return [
    mk("group", t[0], t[1], { group: code, status: "scheduled" }),
    mk("group", t[0], t[2], { group: code, score: [2, 0] }),
    mk("group", t[1], t[2], { group: code, score: [1, 0] }),
  ];
}

describe("computeKnockoutTeamUpdates", () => {
  it("writes both confirmed group slots onto an R32 fixture", () => {
    const r32 = mk("r32", "Winner Group A", "2nd Group A", { id: "ko" });
    const updates = computeKnockoutTeamUpdates([...completeGroup("A"), r32]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ id: "ko", home_team: "A1", away_team: "A2" });
  });

  it("writes only the confirmed side when the other is unresolved", () => {
    const r32 = mk("r32", "Winner Group A", "Winner Match 99", { id: "ko" });
    const updates = computeKnockoutTeamUpdates([...completeGroup("A"), r32]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ id: "ko", home_team: "A1" });
    expect(updates[0].away_team).toBeUndefined();
  });

  it("skips a provisional slot (group not complete)", () => {
    const r32 = mk("r32", "Winner Group A", "Winner Match 99", { id: "ko" });
    const updates = computeKnockoutTeamUpdates([...partialGroup("A"), r32]);
    expect(updates).toEqual([]);
  });

  it("skips an unresolved later-round slot", () => {
    // The r32 (numbered 73) is not final → Winner Match 73 stays a placeholder.
    const r32 = mk("r32", "A1", "B1", { id: "src" });
    const r16 = mk("r16", "Winner Match 73", "Winner Match 74", { id: "ko16" });
    const updates = computeKnockoutTeamUpdates([r32, r16]);
    expect(updates).toEqual([]);
  });

  it("is idempotent — no update when the stored team already equals the confirmed resolution", () => {
    const r32 = mk("r32", "A1", "Winner Match 99", { id: "ko" });
    const updates = computeKnockoutTeamUpdates([...completeGroup("A"), r32]);
    expect(updates).toEqual([]);
  });

  it("ignores group-stage rows (no knockout fixtures → no updates)", () => {
    const updates = computeKnockoutTeamUpdates([...completeGroup("A")]);
    expect(updates).toEqual([]);
  });
});
