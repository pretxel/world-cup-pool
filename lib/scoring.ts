import type { HitType } from "@/lib/db";

export interface ScoredPrediction {
  points: number;
  hit_type: HitType;
}

// Pure TypeScript replica of the SQL function `public.compute_match_scores`.
// Kept here so the scoring rules can be unit-tested without a database.
export function scorePrediction(
  prediction: { home_goals: number; away_goals: number },
  result: { home_score: number; away_score: number },
): ScoredPrediction {
  const exact =
    prediction.home_goals === result.home_score && prediction.away_goals === result.away_score;
  if (exact) return { points: 5, hit_type: "exact" };

  const predDiff = prediction.home_goals - prediction.away_goals;
  const actualDiff = result.home_score - result.away_score;
  const sameSide = Math.sign(predDiff) === Math.sign(actualDiff);

  if (sameSide && predDiff === actualDiff) {
    return { points: 3, hit_type: "winner_gd" };
  }
  if (sameSide) {
    return { points: 1, hit_type: "winner" };
  }
  return { points: 0, hit_type: "miss" };
}
