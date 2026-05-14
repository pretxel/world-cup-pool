import { describe, expect, it } from "vitest";
import { scorePrediction } from "@/lib/scoring";

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
});
