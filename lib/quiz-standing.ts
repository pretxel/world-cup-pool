import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { QuizStandingRow } from "@/lib/db";

export type QuizStanding = { row: QuizStandingRow; players: number };

/**
 * Read a user's quiz standing (streak, points, answered, rank) live from the
 * public v_quiz_standing view, plus the total number of ranked players. The
 * URL only identifies the user — numbers are never trusted from it — so a stale
 * or tampered share link always renders the truthful current standing. Returns
 * null when the user has no quiz answers (no row in the view).
 *
 * Accepts the caller's client so both the cookie-bound landing page and the
 * cookie-less OG route (anon scrapers) share one query.
 */
export async function loadQuizStanding(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<QuizStanding | null> {
  const [{ data: row }, { count }] = await Promise.all([
    supabase
      .from("v_quiz_standing")
      .select("user_id, display_name, streak, total_points, total_answered, rank")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("v_quiz_standing").select("*", { count: "exact", head: true }),
  ]);
  if (!row) return null;
  return { row, players: count ?? 0 };
}
