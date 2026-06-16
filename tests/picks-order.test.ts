import { describe, expect, it } from "vitest";
import { sortPicksByKickoff, type SortablePick } from "@/lib/picks-order";

// The My Picks list must read earliest-kickoff-first as a deterministic
// property, established over the full set before pagination. The embedded
// `.order` in the query is a no-op (it orders the to-one embed, not the
// predictions), so this in-memory sort owns the contract. These tests pin it:
// kickoff ascending, stable tiebreak by match_id, junk sorted last, no
// mutation, and the windowing property pagination relies on.

function pick(match_id: string, kickoff_at: string | null): SortablePick {
  return { match_id, matches: kickoff_at === null ? null : { kickoff_at } };
}

describe("sortPicksByKickoff", () => {
  it("orders earliest-kickoff first across multiple dates", () => {
    const picks = [
      pick("c", "2026-06-20T18:00:00Z"),
      pick("a", "2026-06-18T15:00:00Z"),
      pick("b", "2026-06-19T12:00:00Z"),
    ];
    expect(sortPicksByKickoff(picks).map((p) => p.match_id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("breaks kickoff ties by match_id ascending, deterministically", () => {
    const kickoff = "2026-06-18T15:00:00Z";
    const picks = [
      pick("m3", kickoff),
      pick("m1", kickoff),
      pick("m2", kickoff),
    ];
    const once = sortPicksByKickoff(picks).map((p) => p.match_id);
    const twice = sortPicksByKickoff([...picks].reverse()).map(
      (p) => p.match_id,
    );
    expect(once).toEqual(["m1", "m2", "m3"]);
    // Same result regardless of input order → stable / reproducible.
    expect(twice).toEqual(once);
  });

  it("sorts missing or invalid kickoff_at last", () => {
    const picks = [
      pick("missing", null),
      pick("valid-late", "2026-06-25T15:00:00Z"),
      pick("invalid", "not-a-date"),
      pick("valid-early", "2026-06-18T15:00:00Z"),
    ];
    const ordered = sortPicksByKickoff(picks).map((p) => p.match_id);
    expect(ordered.slice(0, 2)).toEqual(["valid-early", "valid-late"]);
    // The two junk entries land last, tie-broken by match_id ("invalid" < "missing").
    expect(ordered.slice(2)).toEqual(["invalid", "missing"]);
  });

  it("returns a new array and does not mutate the input", () => {
    const picks = [
      pick("b", "2026-06-19T12:00:00Z"),
      pick("a", "2026-06-18T15:00:00Z"),
    ];
    const original = [...picks];
    const sorted = sortPicksByKickoff(picks);
    expect(sorted).not.toBe(picks);
    // Input untouched.
    expect(picks).toEqual(original);
    expect(picks.map((p) => p.match_id)).toEqual(["b", "a"]);
  });

  it("preserves caller fields on the returned rows (generic passthrough)", () => {
    type Row = SortablePick & { home_goals: number };
    const picks: Row[] = [
      { match_id: "b", matches: { kickoff_at: "2026-06-19T12:00:00Z" }, home_goals: 2 },
      { match_id: "a", matches: { kickoff_at: "2026-06-18T15:00:00Z" }, home_goals: 1 },
    ];
    expect(sortPicksByKickoff(picks).map((p) => p.home_goals)).toEqual([1, 2]);
  });

  it("yields a non-decreasing kickoff sequence across paginated windows", () => {
    // 12 picks, shuffled, some sharing kickoffs — mirror the page's pagination.
    const picks = [
      pick("m07", "2026-06-22T15:00:00Z"),
      pick("m01", "2026-06-18T12:00:00Z"),
      pick("m05", "2026-06-20T18:00:00Z"),
      pick("m11", "2026-06-24T18:00:00Z"),
      pick("m03", "2026-06-19T15:00:00Z"),
      pick("m09", "2026-06-23T12:00:00Z"),
      pick("m02", "2026-06-18T12:00:00Z"), // ties m01
      pick("m12", "2026-06-25T12:00:00Z"),
      pick("m04", "2026-06-20T18:00:00Z"), // ties m05
      pick("m08", "2026-06-22T18:00:00Z"),
      pick("m06", "2026-06-21T12:00:00Z"),
      pick("m10", "2026-06-23T15:00:00Z"),
    ];

    const sorted = sortPicksByKickoff(picks);
    const times = sorted.map((p) => Date.parse(p.matches!.kickoff_at!));

    // Globally non-decreasing.
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    }

    // Pagination windows (5 per page) partition that one order: the last pick of
    // any page kicks off at or before the first pick of the next.
    const PAGE = 5;
    for (let start = PAGE; start < times.length; start += PAGE) {
      expect(times[start]).toBeGreaterThanOrEqual(times[start - 1]);
    }
  });
});
