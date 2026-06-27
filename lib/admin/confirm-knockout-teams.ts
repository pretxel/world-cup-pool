import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildBracket, type BracketMatchInput } from "@/lib/bracket-core";

// One fixture to update: the row id, the confirmed team(s) to stamp on it, and a
// human label for the admin summary. A side is present only when it changed.
export interface KnockoutTeamUpdate {
  id: string;
  home_team?: string;
  away_team?: string;
  label: string;
}

export interface ConfirmKnockoutTeamsResult {
  updated: number;
  fixtures: string[];
}

// Pure: from the competition's fixtures, derive the confirmed real teams for the
// knockout fixtures and return the updates needed to stamp them. Uses the same
// bracket resolver as the public bracket; emits a side only when that slot
// resolves to a real team with a CONFIRMED status (its source group(s) are
// complete) AND that differs from what is stored. Provisional/placeholder
// resolutions and group-stage rows are never written, so the result is empty
// when nothing is newly confirmed (idempotent). Exported for unit testing.
export function computeKnockoutTeamUpdates(
  matches: BracketMatchInput[],
): KnockoutTeamUpdate[] {
  const storedById = new Map(matches.map((m) => [m.id, m]));
  const { rounds } = buildBracket(matches);
  const updates: KnockoutTeamUpdate[] = [];

  for (const round of rounds) {
    for (const slot of round.matches) {
      const stored = storedById.get(slot.id);
      if (!stored) continue;

      const homeNew =
        slot.home.status === "confirmed" &&
        slot.home.team &&
        slot.home.team !== stored.home_team
          ? slot.home.team
          : undefined;
      const awayNew =
        slot.away.status === "confirmed" &&
        slot.away.team &&
        slot.away.team !== stored.away_team
          ? slot.away.team
          : undefined;

      if (!homeNew && !awayNew) continue;

      const homeName = homeNew ?? stored.home_team;
      const awayName = awayNew ?? stored.away_team;
      updates.push({
        id: slot.id,
        ...(homeNew ? { home_team: homeNew } : {}),
        ...(awayNew ? { away_team: awayNew } : {}),
        label: `${homeName} v ${awayName}`,
      });
    }
  }

  return updates;
}

// Loads the managed competition's fixtures, computes the confirmed-team updates,
// applies each by id via the service-role client, and reports what changed.
// Idempotent: a run with no newly-confirmed slots applies nothing. The admin
// action layer asserts authorization and scopes `competitionId`.
export async function applyKnockoutTeamConfirmation(
  competitionId: string,
): Promise<ConfirmKnockoutTeamsResult> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("matches")
    .select(
      "id, home_team, away_team, group_code, home_score, away_score, status, kickoff_at, stage, venue",
    )
    .eq("competition_id", competitionId);
  if (error) throw new Error(`[confirm-knockout-teams] load matches: ${error.message}`);

  const updates = computeKnockoutTeamUpdates((data ?? []) as BracketMatchInput[]);

  for (const u of updates) {
    const patch: { home_team?: string; away_team?: string } = {};
    if (u.home_team) patch.home_team = u.home_team;
    if (u.away_team) patch.away_team = u.away_team;
    const { error: updErr } = await admin
      .from("matches")
      .update(patch)
      .eq("id", u.id)
      .eq("competition_id", competitionId);
    if (updErr) {
      throw new Error(`[confirm-knockout-teams] update ${u.id}: ${updErr.message}`);
    }
  }

  return { updated: updates.length, fixtures: updates.map((u) => u.label) };
}
