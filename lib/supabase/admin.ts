import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, requireServiceRoleKey } from "@/lib/env";
import type { Database } from "@/lib/database.types";

export function createAdminSupabaseClient() {
  return createClient<Database>(env.supabaseUrl, requireServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
