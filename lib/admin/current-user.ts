import type { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// True when the signed-in user's profile is flagged is_admin. Returns false for
// anonymous visitors and on any lookup error — admins are operators, not
// contestants, so they are excluded from leaderboards and blocked from
// submitting picks / quiz answers. Shared by the pages (to disable controls)
// and the server actions (to reject writes), so the rule lives in one place.
export async function isCurrentUserAdmin(supabase: ServerClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return false;
  return data?.is_admin ?? false;
}
