import { describe, expect, it } from "vitest";
import { scorePrediction, STAGE_POINT_MULTIPLIER } from "@/lib/scoring";

describe("scorePrediction", () => {
  it("awards 5 points and 'exact' for matching scores", () => {
    expect(scorePrediction({ home_goals: 2, away_goals: 1 }, { home_score: 2, away_score: 1 })).toEqual({
      points: 5,
      hit_type: "exact",
    });
  });

  it("awards 3 points and 'winner_gd' for correct winner + same goal diff", () => {
    expect(scorePrediction({ home_goals: 2, away_goals: 1 }, { home_score: 3, away_score: 2 })).toEqual({
      points: 3,
      hit_type: "winner_gd",
    });
  });

  it("awards 3 points and 'winner_gd' for matching draws", () => {
    expect(scorePrediction({ home_goals: 1, away_goals: 1 }, { home_score: 2, away_score: 2 })).toEqual({
      points: 3,
      hit_type: "winner_gd",
    });
  });

  it("awards 1 point and 'winner' for correct winner but wrong goal diff", () => {
    expect(scorePrediction({ home_goals: 3, away_goals: 0 }, { home_score: 3, away_score: 1 })).toEqual({
      points: 1,
      hit_type: "winner",
    });
  });

  it("awards 0 points and 'miss' when the winner is wrong", () => {
    expect(scorePrediction({ home_goals: 2, away_goals: 1 }, { home_score: 1, away_score: 2 })).toEqual({
      points: 0,
      hit_type: "miss",
    });
  });

  it("awards 0 points and 'miss' when predicting a draw but a team wins", () => {
    expect(scorePrediction({ home_goals: 1, away_goals: 1 }, { home_score: 2, away_score: 1 })).toEqual({
      points: 0,
      hit_type: "miss",
    });
  });

  it("awards 0 points and 'miss' when predicting a winner but the match draws", () => {
    expect(scorePrediction({ home_goals: 2, away_goals: 1 }, { home_score: 1, away_score: 1 })).toEqual({
      points: 0,
      hit_type: "miss",
    });
  });

  it("scales an exact pick in the final by ×10 (5 → 50)", () => {
    expect(
      scorePrediction({ home_goals: 2, away_goals: 1 }, { home_score: 2, away_score: 1 }, "final"),
    ).toEqual({ points: 50, hit_type: "exact" });
  });

  it("scales a winner+GD pick in the Round of 32 by ×2 (3 → 6)", () => {
    expect(
      scorePrediction({ home_goals: 2, away_goals: 1 }, { home_score: 3, away_score: 2 }, "r32"),
    ).toEqual({ points: 6, hit_type: "winner_gd" });
  });

  it("keeps group-stage points at the base (×1)", () => {
    expect(
      scorePrediction({ home_goals: 2, away_goals: 1 }, { home_score: 2, away_score: 1 }, "group"),
    ).toEqual({ points: 5, hit_type: "exact" });
    expect(
      scorePrediction({ home_goals: 3, away_goals: 0 }, { home_score: 3, away_score: 1 }, "group"),
    ).toEqual({ points: 1, hit_type: "winner" });
  });

  it("scores a miss as 0 regardless of stage", () => {
    for (const stage of ["group", "r32", "r16", "qf", "sf", "final", "third"]) {
      expect(
        scorePrediction({ home_goals: 2, away_goals: 1 }, { home_score: 1, away_score: 2 }, stage),
      ).toEqual({ points: 0, hit_type: "miss" });
    }
  });

  it("defaults to ×1 for an unknown/unmapped stage", () => {
    expect(
      scorePrediction({ home_goals: 2, away_goals: 1 }, { home_score: 2, away_score: 1 }, "totally-unknown"),
    ).toEqual({ points: 5, hit_type: "exact" });
  });
});

describe("STAGE_POINT_MULTIPLIER", () => {
  it("matches the agreed per-stage factors", () => {
    expect(STAGE_POINT_MULTIPLIER).toEqual({
      group: 1,
      r32: 2,
      r16: 4,
      qf: 6,
      sf: 8,
      final: 10,
      third: 4,
    });
  });
});
