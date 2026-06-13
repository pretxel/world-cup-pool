import { cookies } from "next/headers";
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
