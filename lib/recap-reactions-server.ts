import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildReactionSummary,
  emptyCounts,
  type ReactionSummary,
} from "@/lib/recap-reactions";

// Server-side reads for the recap reaction feature. Counts come from the public,
// active-version-scoped view (v_recap_reaction_counts); the viewer's own
// reactions come from an own-row select on the base table (RLS scopes it to
// auth.uid()). Both degrade to empty on error so the page never breaks on a
// reactions read.

// Per-type counts for an active recap version + the signed-in viewer's own
// selected types. Used to seed the match-detail reaction bar.
export async function getRecapReactionSummary(
  summaryId: string,
  userId: string | null,
): Promise<ReactionSummary> {
  const supabase = await createServerSupabaseClient();

  const { data: countRows } = await supabase
    .from("v_recap_reaction_counts")
    .select("reaction, count")
    .eq("summary_id", summaryId);

  let mineRows: Array<{ reaction: string }> = [];
  if (userId) {
    const { data } = await supabase
      .from("recap_reactions")
      .select("reaction")
      .eq("summary_id", summaryId)
      .eq("user_id", userId);
    mineRows = data ?? [];
  }

  return buildReactionSummary(countRows ?? [], mineRows);
}

// Summed reaction count per match for the landing gallery social-proof badge.
// One bounded read over the active-version counts view, summed in JS so the
// gallery stays a single round-trip. Returns a Map keyed by match_id; matches
// with no reactions are simply absent (the card renders no badge).
export async function getRecapReactionTotalsByMatch(
  matchIds: string[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (matchIds.length === 0) return totals;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("v_recap_reaction_counts")
    .select("match_id, count")
    .in("match_id", matchIds);

  for (const row of data ?? []) {
    if (!row.match_id) continue;
    totals.set(row.match_id, (totals.get(row.match_id) ?? 0) + (row.count ?? 0));
  }
  return totals;
}

// Re-export the empty counts helper so callers can build a zero summary without
// reaching into the shared module separately.
export { emptyCounts };
