// Friendly aliases on top of the auto-generated `Database` types from
// `lib/database.types.ts`. Regenerating types won't overwrite this file.

import type { Database, Tables } from "@/lib/database.types";

export type { Database } from "@/lib/database.types";

export type MatchStage = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";
export type MatchStatus = "scheduled" | "live" | "final" | "cancelled";
export type HitType = "exact" | "winner_gd" | "winner" | "miss";

// The schema-defined CHECK constraints keep these columns to the unions above,
// but the type generator renders them as plain `string`. Override here so our
// app code keeps narrow types.
type Narrow<T, K extends keyof T, V> = Omit<T, K> & { [P in K]: V };

export type ProfileRow = Tables<"profiles">;
export type MatchRow = Narrow<
  Narrow<Tables<"matches">, "stage", MatchStage>,
  "status",
  MatchStatus
>;
export type PredictionRow = Tables<"predictions">;
export type ScoreRow = Narrow<Tables<"scores">, "hit_type", HitType>;
export type NewsArticleRow = Tables<"news_articles">;

export type LeaderboardRow =
  Database["public"]["Functions"]["leaderboard_for_day"]["Returns"][number];
