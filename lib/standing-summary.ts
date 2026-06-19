import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { HitType } from "@/lib/db";

// One player's at-a-glance standing, assembled read-only from existing tables
// and views (`scores`, `predictions`, `v_leaderboard_overall`,
// `leaderboard_rank_snapshot`). No competitive scoring is recomputed or written.
export interface StandingSummary {
  // Total competitive points across every scored prediction.
  totalPoints: number;
  // Number of exact-scoreline predictions.
  exactCount: number;
  // How many predictions the player has made in total.
  totalPicks: number;
  // Finals-only accuracy breakdown — counts only matches that are `final` with a
  // matching `scores` row, so it agrees with the per-match badges on /my-picks.
  finals: {
    scored: number;
    exact: number;
    winner: number;
    miss: number;
  };
  // Current overall rank from `v_leaderboard_overall`, or null when the player
  // is not yet ranked.
  rank: number | null;
  // Rank movement since the last snapshot (`previousRank - currentRank`, so a
  // positive number means the player climbed). Null when no baseline exists.
  rankDelta: number | null;
}

// Pure derivation, no DB. Folds the already-loaded rows into a StandingSummary so
// the sign of the delta, the missing-snapshot null, and the finals-only gating
// can be unit-tested without Supabase.
export function deriveStandingSummary(input: {
  scores: ReadonlyArray<{
    match_id: string;
    points: number | null;
    hit_type: HitType;
  }>;
  totalPicks: number;
  // Match status keyed by match id, for finals-only gating. A match counts in
  // the finals breakdown only when it is `final` AND has a `scores` row.
  matchStatusById: ReadonlyMap<string, string>;
  currentRank: number | null;
  previousRank: number | null;
}): StandingSummary {
  const { scores, totalPicks, matchStatusById, currentRank, previousRank } =
    input;

  let totalPoints = 0;
  let exactCount = 0;
  const finals = { scored: 0, exact: 0, winner: 0, miss: 0 };

  for (const s of scores) {
    totalPoints += s.points ?? 0;
    if (s.hit_type === "exact") exactCount += 1;

    // Finals breakdown: gate on a `final` match so unplayed fixtures never count.
    if (matchStatusById.get(s.match_id) !== "final") continue;
    finals.scored += 1;
    if (s.hit_type === "exact") finals.exact += 1;
    else if (s.hit_type === "winner_gd" || s.hit_type === "winner")
      finals.winner += 1;
    else finals.miss += 1;
  }

  // `previousRank - currentRank`: positive = climbed. Missing either side (no
  // snapshot baseline / unranked) yields no delta rather than a guess.
  const rankDelta =
    previousRank != null && currentRank != null
      ? previousRank - currentRank
      : null;

  return {
    totalPoints,
    exactCount,
    totalPicks,
    finals,
    rank: currentRank,
    rankDelta,
  };
}

// Server helper: assembles a player's StandingSummary from existing tables and
// views. Read-only. Both `/my-picks` and the signed-in landing call this so the
// queries live in one place. Never throws on missing rows — a player with no
// scores / no rank / no snapshot degrades to an empty-but-valid summary.
export async function getStandingSummary(
  userId: string,
): Promise<StandingSummary> {
  const supabase = await createServerSupabaseClient();

  const [scoresRes, picksRes, rankRes, snapshotRes] = await Promise.all([
    supabase
      .from("scores")
      .select("match_id, points, hit_type")
      .eq("user_id", userId),
    supabase
      .from("predictions")
      .select("match_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("v_leaderboard_overall")
      .select("rank")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("leaderboard_rank_snapshot")
      .select("rank")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const scores = (scoresRes.data ?? []) as Array<{
    match_id: string;
    points: number | null;
    hit_type: HitType;
  }>;

  // Status of every match the player has a score for, for finals-only gating.
  const matchIds = scores.map((s) => s.match_id);
  const matchStatusById = new Map<string, string>();
  if (matchIds.length > 0) {
    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, status, home_score, away_score")
      .in("id", matchIds);
    for (const m of matchRows ?? []) {
      // Only treat as final when both scores are present, mirroring how the
      // per-match badges and `buildGroupTables` gate on completed results.
      const complete =
        m.status === "final" && m.home_score != null && m.away_score != null;
      matchStatusById.set(m.id, complete ? "final" : (m.status ?? ""));
    }
  }

  return deriveStandingSummary({
    scores,
    totalPicks: picksRes.count ?? 0,
    matchStatusById,
    currentRank: rankRes.data?.rank ?? null,
    previousRank: snapshotRes.data?.rank ?? null,
  });
}
