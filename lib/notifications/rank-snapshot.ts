import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// Captures every ranked player's current overall-leaderboard rank into
// leaderboard_rank_snapshot so a previous-rank baseline survives the score
// recompute that follows. MUST run BEFORE runSync(): once scores are recomputed
// v_leaderboard_overall reflects the new standing, so a snapshot taken after the
// recompute would zero out every delta. Reads rank from the same view the email
// and leaderboard display, so the delta stays self-consistent. Upserts one row
// per ranked player keyed (competition_id, user_id), so the table always holds
// "the rank as of the previous run". Returns the number of rows snapshotted.
export async function captureRankSnapshot(admin: AdminClient): Promise<number> {
  const { data, error } = await admin
    .from("v_leaderboard_overall")
    .select("user_id, rank");
  if (error) {
    throw new Error(`[rank-snapshot] load leaderboard: ${error.message}`);
  }

  // The active competition scopes both the view rows and the snapshot key; read
  // it once so the upsert key matches what active_competition_id() resolves to.
  const { data: compId, error: compErr } = await admin.rpc("active_competition_id");
  if (compErr) {
    throw new Error(`[rank-snapshot] active competition: ${compErr.message}`);
  }
  if (!compId) {
    // No active competition → nothing meaningful to snapshot.
    return 0;
  }

  const rows = (data ?? [])
    .filter(
      (r): r is { user_id: string; rank: number } =>
        r.user_id != null && r.rank != null,
    )
    .map((r) => ({
      competition_id: compId as string,
      user_id: r.user_id,
      rank: r.rank,
      captured_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return 0;

  const { error: upErr } = await admin
    .from("leaderboard_rank_snapshot")
    .upsert(rows, { onConflict: "competition_id,user_id" });
  if (upErr) {
    throw new Error(`[rank-snapshot] upsert: ${upErr.message}`);
  }

  return rows.length;
}
