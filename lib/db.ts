// Friendly aliases on top of the auto-generated `Database` types from
// `lib/database.types.ts`. Regenerating types won't overwrite this file.

import type { Database, Tables } from "@/lib/database.types";

export type { Database } from "@/lib/database.types";

// Stage keys are competition-defined (see each competition's format_config),
// so this is an open string rather than a fixed union. The well-known World Cup
// keys are kept here for autocomplete; any other string is also valid.
export type MatchStage = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final" | (string & {});
export type MatchStatus = "scheduled" | "live" | "final" | "cancelled";
export type HitType = "exact" | "winner_gd" | "winner" | "miss";

// The schema-defined CHECK constraints keep these columns to the unions above,
// but the type generator renders them as plain `string`. Override here so our
// app code keeps narrow types.
type Narrow<T, K extends keyof T, V> = Omit<T, K> & { [P in K]: V };

export type CompetitionRow = Tables<"competitions">;
export type ProfileRow = Tables<"profiles">;
export type MatchRow = Narrow<
  Narrow<Tables<"matches">, "stage", MatchStage>,
  "status",
  MatchStatus
>;
export type PredictionRow = Tables<"predictions">;
export type ScoreRow = Narrow<Tables<"scores">, "hit_type", HitType>;
export type NewsArticleRow = Tables<"news_articles">;
export type QuizQuestionPublicRow = Tables<"v_quiz_questions_public">;
export type QuizAnswerRow = Tables<"quiz_answers">;
export type QuizLeaderboardRow = Tables<"v_quiz_leaderboard">;
export type QuizStandingRow = Tables<"v_quiz_standing">;
export type QuizReminderLogRow = Tables<"quiz_reminder_log">;

// One recorded background-job run. `kind`/`trigger`/`status` are CHECK-narrowed
// in the schema but render as plain `string`; the operations module re-narrows
// them to its own unions (see lib/operations/record-run.ts).
export type OperationRunRow = Tables<"operation_runs">;

export type LeaderboardRow =
  Database["public"]["Functions"]["leaderboard_for_day"]["Returns"][number];

export type GroupMemberRole = "owner" | "member";
export type GroupRow = Tables<"groups">;
export type GroupMemberRow = Narrow<Tables<"group_members">, "role", GroupMemberRole>;

// One row of a group's mini board. Same shape as the global LeaderboardRow,
// sourced from leaderboard_for_group() instead of leaderboard_for_day().
export type GroupBoardRow =
  Database["public"]["Functions"]["leaderboard_for_group"]["Returns"][number];
