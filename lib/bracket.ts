import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompetition } from "@/lib/competition";
import {
  buildBracket,
  type Bracket,
  type BracketMatchInput,
} from "@/lib/bracket-core";

export type BracketResult = Bracket & {
  // Raw rows the bracket was built from, for opportunistic sync.
  matches: BracketMatchInput[];
};

// Build the projected knockout bracket for the active competition: group +
// knockout fixtures folded through the pure resolver. Never throws — a missing
// competition or no knockout fixtures yields an empty, `hasKnockout: false`
// result.
export async function getBracket(): Promise<BracketResult> {
  const competition = await getActiveCompetition();
  if (!competition) return { rounds: [], hasKnockout: false, matches: [] };

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("matches")
    .select(
      "id, home_team, away_team, group_code, home_score, away_score, status, kickoff_at, stage",
    )
    .eq("competition_id", competition.id);

  const matches = (data ?? []) as BracketMatchInput[];
  return { ...buildBracket(matches), matches };
}
