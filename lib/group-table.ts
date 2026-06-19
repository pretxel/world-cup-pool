import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompetition } from "@/lib/competition";
import { groupStageKey } from "@/lib/competition-schema";
import {
  buildGroupTables,
  type GroupTableMatch,
  type SimulatedGroup,
} from "@/lib/group-standings";

export type { GroupTableMatch } from "@/lib/group-standings";

export type GroupTablesResult = {
  // Real, results-derived standings for every group, A→L.
  groups: SimulatedGroup[];
  // The raw match rows the tables were built from, for opportunistic sync.
  matches: GroupTableMatch[];
  // False when the active competition has no group stage (or none is active);
  // the page renders an empty state rather than an error in that case.
  hasGroupStage: boolean;
};

// Build the real group tables for the active competition. Reads only the
// group-stage matches and folds their actual results into the shared standings
// engine. Never throws — a missing competition or group stage yields an empty,
// `hasGroupStage: false` result.
export async function getGroupTables(): Promise<GroupTablesResult> {
  const competition = await getActiveCompetition();
  const groupKey = competition ? groupStageKey(competition.format) : null;
  if (!competition || !groupKey) {
    return { groups: [], matches: [], hasGroupStage: false };
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("matches")
    .select(
      "id, home_team, away_team, group_code, home_score, away_score, status, kickoff_at",
    )
    .eq("competition_id", competition.id)
    .eq("stage", groupKey);

  const matches = (data ?? []) as GroupTableMatch[];
  return { groups: buildGroupTables(matches), matches, hasGroupStage: true };
}
