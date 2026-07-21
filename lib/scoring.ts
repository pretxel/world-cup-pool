import type { HitType } from "@/lib/db";
import type { CompetitionFormat } from "@/lib/competition-schema";
import { getStageConfig } from "@/lib/competition-schema";

export interface ScoredPrediction {
  points: number;
  hit_type: HitType;
}

// Base accuracy points per hit type, before the per-stage multiplier. Exported
// so the landing explainer can derive the points on offer without hardcoding.
export const BASE_POINTS = {
  exact: 5,
  winner_gd: 3,
  winner: 1,
} as const;

// Per-stage point multiplier (strong escalation). Mirrors the `CASE` in the SQL
// function `public.compute_match_scores`. Unknown/unmapped stages default to ×1.
export const STAGE_POINT_MULTIPLIER: Record<string, number> = {
  group: 1,
  r32: 2,
  r16: 4,
  qf: 6,
  sf: 8,
  final: 10,
  third: 4,
};

// Resolve the point multiplier for a stage, preferring the competition's
// format_config.stages[].pointMultiplier when present, falling back to the
// hardcoded STAGE_POINT_MULTIPLIER map, and ultimately ×1.
export function resolveStageMultiplier(
  stage: string,
  format?: CompetitionFormat | null,
): number {
  if (format) {
    const cfg = getStageConfig(format, stage);
    if (cfg?.pointMultiplier != null) return cfg.pointMultiplier;
  }
  return STAGE_POINT_MULTIPLIER[stage] ?? 1;
}

// Pure TypeScript replica of the SQL function `public.compute_match_scores`.
// Kept here so the scoring rules can be unit-tested without a database.
// `stage` and `format` are optional: when omitted the multiplier is ×1, which
// preserves the original flat-scoring behavior.
export function scorePrediction(
  prediction: { home_goals: number; away_goals: number },
  result: { home_score: number; away_score: number },
  stage?: string,
  format?: CompetitionFormat | null,
): ScoredPrediction {
  const mult = resolveStageMultiplier(stage ?? "", format);

  const exact =
    prediction.home_goals === result.home_score && prediction.away_goals === result.away_score;
  if (exact) return { points: BASE_POINTS.exact * mult, hit_type: "exact" };

  const predDiff = prediction.home_goals - prediction.away_goals;
  const actualDiff = result.home_score - result.away_score;
  const sameSide = Math.sign(predDiff) === Math.sign(actualDiff);

  if (sameSide && predDiff === actualDiff) {
    return { points: BASE_POINTS.winner_gd * mult, hit_type: "winner_gd" };
  }
  if (sameSide) {
    return { points: BASE_POINTS.winner * mult, hit_type: "winner" };
  }
  return { points: 0, hit_type: "miss" };
}
