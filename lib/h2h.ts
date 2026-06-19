import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { HitType } from "@/lib/db";

// One player's drawn standing for a head-to-head. Only the fields the landing
// page + OG card render; numbers are always read live, never from the URL.
export type H2HStanding = {
  userId: string;
  displayName: string | null;
  rank: number;
  totalPoints: number;
  exactHits: number;
};

export type H2HStandings = { a: H2HStanding; b: H2HStanding };

// A single recent-form pip: a scored match classified as hit or miss.
export type FormPip = { matchId: string; outcome: "hit" | "miss" };

// `exact`, `winner_gd`, and `winner` all count as a hit; only `miss` is a miss.
function classifyHit(hitType: string): "hit" | "miss" {
  return (hitType as HitType) === "miss" ? "miss" : "hit";
}

/**
 * Read both players' standings (rank, name, points, exact hits) live from the
 * public v_leaderboard_overall view. Returns null when EITHER player is absent
 * (never scored / unknown), so the caller renders a 404 rather than a
 * half-populated comparison. The two ids are queried independently so the result
 * can be mapped back to the requested `a`/`b` order regardless of view ordering.
 *
 * Accepts the caller's client so both the cookie-bound landing page and the
 * cookie-less OG route (anon scrapers) share one query.
 */
export async function loadH2HStandings(
  supabase: SupabaseClient<Database>,
  idA: string,
  idB: string,
): Promise<H2HStandings | null> {
  const [{ data: rowA }, { data: rowB }] = await Promise.all([
    supabase
      .from("v_leaderboard_overall")
      .select("user_id, rank, display_name, total_points, exact_hits")
      .eq("user_id", idA)
      .maybeSingle(),
    supabase
      .from("v_leaderboard_overall")
      .select("user_id, rank, display_name, total_points, exact_hits")
      .eq("user_id", idB)
      .maybeSingle(),
  ]);
  if (!rowA || !rowB) return null;

  const toStanding = (id: string, row: NonNullable<typeof rowA>): H2HStanding => ({
    userId: id,
    displayName: row.display_name,
    rank: row.rank ?? 0,
    totalPoints: row.total_points ?? 0,
    exactHits: row.exact_hits ?? 0,
  });

  return { a: toStanding(idA, rowA), b: toStanding(idB, rowB) };
}

/**
 * Derive a player's recent form from the scores table: the latest `limit`
 * scored matches by computed_at desc (newest first), each classified hit/miss
 * from its hit_type. Used by both the landing page and the OG card so the strips
 * match. Returns [] when the player has no scored matches (the comparison still
 * renders rank/points/exact). Failures degrade to [] — form is a nice-to-have.
 */
export async function loadRecentForm(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 5,
): Promise<FormPip[]> {
  const { data, error } = await supabase
    .from("scores")
    .select("match_id, hit_type, computed_at")
    .eq("user_id", userId)
    .order("computed_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => ({
    matchId: row.match_id,
    outcome: classifyHit(row.hit_type),
  }));
}
