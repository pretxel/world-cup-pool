import { describe, expect, it } from "vitest";
import { deriveStandingSummary } from "@/lib/standing-summary";
import type { HitType } from "@/lib/db";

const score = (match_id: string, points: number, hit_type: HitType) => ({
  match_id,
  points,
  hit_type,
});

describe("deriveStandingSummary", () => {
  it("sums points and counts exact picks", () => {
    const summary = deriveStandingSummary({
      scores: [
        score("m1", 5, "exact"),
        score("m2", 3, "winner_gd"),
        score("m3", 0, "miss"),
      ],
      totalPicks: 4,
      matchStatusById: new Map(),
      currentRank: null,
      previousRank: null,
    });
    expect(summary.totalPoints).toBe(8);
    expect(summary.exactCount).toBe(1);
    expect(summary.totalPicks).toBe(4);
  });

  it("computes a positive delta when the player climbed", () => {
    const summary = deriveStandingSummary({
      scores: [],
      totalPicks: 0,
      matchStatusById: new Map(),
      currentRank: 3,
      previousRank: 7,
    });
    // previousRank - currentRank = 7 - 3 = +4 (climbed four spots).
    expect(summary.rank).toBe(3);
    expect(summary.rankDelta).toBe(4);
  });

  it("computes a negative delta when the player dropped", () => {
    const summary = deriveStandingSummary({
      scores: [],
      totalPicks: 0,
      matchStatusById: new Map(),
      currentRank: 9,
      previousRank: 5,
    });
    expect(summary.rankDelta).toBe(-4);
  });

  it("returns a null delta when no snapshot baseline exists", () => {
    const summary = deriveStandingSummary({
      scores: [],
      totalPicks: 0,
      matchStatusById: new Map(),
      currentRank: 4,
      previousRank: null,
    });
    expect(summary.rank).toBe(4);
    expect(summary.rankDelta).toBeNull();
  });

  it("returns a null delta and null rank when unranked", () => {
    const summary = deriveStandingSummary({
      scores: [],
      totalPicks: 0,
      matchStatusById: new Map(),
      currentRank: null,
      previousRank: 6,
    });
    expect(summary.rank).toBeNull();
    expect(summary.rankDelta).toBeNull();
  });

  it("counts the finals breakdown only over final matches", () => {
    const summary = deriveStandingSummary({
      scores: [
        score("m1", 5, "exact"),
        score("m2", 1, "winner"),
        score("m3", 3, "winner_gd"),
        score("m4", 0, "miss"),
        // Scored but the match is not final yet (e.g. live) → excluded.
        score("m5", 5, "exact"),
      ],
      totalPicks: 5,
      matchStatusById: new Map([
        ["m1", "final"],
        ["m2", "final"],
        ["m3", "final"],
        ["m4", "final"],
        ["m5", "live"],
      ]),
      currentRank: 1,
      previousRank: 1,
    });
    expect(summary.finals).toEqual({
      scored: 4,
      exact: 1,
      winner: 2, // winner + winner_gd
      miss: 1,
    });
    // Exact count over ALL scores still includes the non-final exact pick.
    expect(summary.exactCount).toBe(2);
    expect(summary.rankDelta).toBe(0);
  });

  it("excludes scores with no matching final match from the breakdown", () => {
    const summary = deriveStandingSummary({
      scores: [score("m1", 5, "exact")],
      totalPicks: 1,
      // No entry for m1 → treated as not final.
      matchStatusById: new Map(),
      currentRank: null,
      previousRank: null,
    });
    expect(summary.finals.scored).toBe(0);
  });
});
