import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TZ_COOKIE, isValidTimeZone } from "@/lib/match-utils";

// Read the visitor's IANA timezone from the `tz` cookie (written client-side by
// <TimezoneSync/>). Returns a validated zone, or null when the cookie is absent
// or holds a value Intl can't resolve — callers fall back to UTC grouping.
//
// Reading a cookie opts the route into dynamic rendering; /matches is already
// dynamic (auth + searchParams), so this adds no new constraint.
export async function readTimeZoneCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(TZ_COOKIE)?.value;
  if (value && isValidTimeZone(value)) return value;
  return null;
}

// Persist the signed-in visitor's detected timezone onto profiles.timezone so
// the reminder crons — which have no request, hence no `tz` cookie — can bucket
// them to ~7am local. Detection stays client-side in <TimezoneSync/>; this only
// mirrors the already-validated cookie value into the profile when it differs
// from the stored one.
//
// Best-effort and self-healing, mirroring <TimezoneSync/>: it no-ops on an
// absent/invalid cookie, on an anonymous request, and when the value already
// matches, and it swallows any write error so it can never block or break page
// rendering. Pass the validated cookie value (e.g. from readTimeZoneCookie) to
// avoid re-reading cookies; null skips the write.
export async function persistTimeZoneForCurrentUser(timeZone: string | null): Promise<void> {
  try {
    if (!timeZone || !isValidTimeZone(timeZone)) return;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.timezone === timeZone) return;

    const { error } = await supabase
      .from("profiles")
      .update({ timezone: timeZone })
      .eq("id", user.id);
    if (error) {
      console.error("[timezone] persist failed:", error.message);
    }
  } catch (err) {
    // Never let a timezone write break the page — same posture as TimezoneSync.
    console.error("[timezone] persist threw:", err);
  }
}
