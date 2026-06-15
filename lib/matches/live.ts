import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isConfirmedMatch } from "@/lib/match-utils";

// A fixture as the landing "Tournament live" section needs it. A trimmed slice
// of `matches` — just what the live list + next-up card render.
export type LiveFixture = {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string;
  status: string;
  stage: string;
  group_code: string | null;
};

export type LiveMatchesPayload = {
  live: LiveFixture[];
  nextUp: LiveFixture | null;
};

// A fixture is "live now" when the DB marks it live, or it has kicked off and is
// not yet final/cancelled — mirroring the kickoff rule in `lockReason` so the
// landing page agrees with match locking.
export function isLiveNow(m: { status: string; kickoff_at: string }): boolean {
  if (m.status === "final" || m.status === "cancelled") return false;
  if (m.status === "live") return true;
  return new Date(m.kickoff_at).getTime() <= Date.now();
}

// Live fixtures (ordered by kickoff) plus the soonest upcoming scheduled fixture
// as a fallback, scoped to the active competition. Placeholder knockout rows
// (no resolvable flag, e.g. "Winner R32-1") are excluded so neither the live
// list nor the next-up card reads like a bracket diagram. Never throws — a
// failure degrades to an empty payload.
export async function getLiveAndNextUp(
  competitionId?: string,
): Promise<LiveMatchesPayload> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("matches")
      .select(
        "id, home_team, away_team, home_score, away_score, kickoff_at, status, stage, group_code",
      );
    if (competitionId) query = query.eq("competition_id", competitionId);
    const { data } = await query.order("kickoff_at", { ascending: true });

    const confirmed = ((data ?? []) as LiveFixture[]).filter(isConfirmedMatch);
    const live = confirmed.filter(isLiveNow);
    const now = Date.now();
    const nextUp =
      confirmed.find(
        (m) =>
          m.status === "scheduled" && new Date(m.kickoff_at).getTime() > now,
      ) ?? null;

    return { live, nextUp };
  } catch {
    return { live: [], nextUp: null };
  }
}
