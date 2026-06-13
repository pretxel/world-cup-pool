import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveCompetition, type ResolvedCompetition } from "@/lib/competition";

// Admin-only "managed competition" context: which competition the admin is
// editing in the fixtures/results/sync surface. Distinct from the PUBLIC active
// competition — switching managed never changes what visitors see. Stored in an
// httpOnly cookie and resolved via the service-role client so a non-active
// (draft) competition is readable. Falls back to the active competition when
// the cookie is missing, invalid, or points at a deleted row.
export const MANAGED_COMPETITION_COOKIE = "wcp_admin_managed_competition";

export const getManagedCompetition = cache(
  async (): Promise<ResolvedCompetition | null> => {
    const admin = createAdminSupabaseClient();
    const cookieStore = await cookies();
    const cookieId = cookieStore.get(MANAGED_COMPETITION_COOKIE)?.value;

    if (cookieId) {
      const { data } = await admin
        .from("competitions")
        .select("*")
        .eq("id", cookieId)
        .maybeSingle();
      if (data) return resolveCompetition(data);
      // Stale cookie (deleted competition) → clear best-effort. Setting a
      // cookie throws outside an action/route handler, so swallow it; the
      // fallback below still returns a sane value.
      try {
        cookieStore.delete(MANAGED_COMPETITION_COOKIE);
      } catch {
        // ignore — can't mutate cookies during a render
      }
    }

    const { data: active } = await admin
      .from("competitions")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();
    return active ? resolveCompetition(active) : null;
  },
);

export async function getManagedCompetitionId(): Promise<string | null> {
  return (await getManagedCompetition())?.id ?? null;
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// A matches query already filtered to the managed competition. Centralizes the
// scope so no admin read forgets it. Callers add their own .select()/.eq().
export function scopedMatchesQuery(admin: AdminClient, managedId: string) {
  return admin.from("matches").select("*").eq("competition_id", managedId);
}

// Guard before a mutating admin action: confirm the target match belongs to the
// managed competition. Service-role writes bypass RLS, so this read-back is the
// fence that stops a stale/forged match_id from another competition being
// mutated. Throws with a clear message when the match is out of scope.
export async function assertMatchInManaged(
  admin: AdminClient,
  matchId: string,
  managedId: string,
): Promise<void> {
  const { data } = await admin
    .from("matches")
    .select("id")
    .eq("id", matchId)
    .eq("competition_id", managedId)
    .maybeSingle();
  if (!data) {
    throw new Error("Match does not belong to the managed competition");
  }
}
