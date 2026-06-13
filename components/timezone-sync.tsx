"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_COOKIE } from "@/lib/match-utils";

// One-year cookie: the timezone rarely changes, and a stale value self-heals on
// the next mount (we rewrite + refresh whenever it no longer matches).
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  for (const part of document.cookie.split("; ")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

// Detects the browser's IANA timezone and persists it in the `tz` cookie so the
// server can group /matches by the visitor's local day. On a mismatch it writes
// the cookie and refreshes the route so the server re-renders with the new
// grouping. No-op once the cookie already matches — so the common case is a
// single read with no refresh. IANA names are cookie-safe (letters, digits,
// `/ _ - +`), so the value is stored verbatim and validated server-side.
export function TimezoneSync() {
  const router = useRouter();

  useEffect(() => {
    let tz: string;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz || readCookie(TZ_COOKIE) === tz) return;

    document.cookie = `${TZ_COOKIE}=${tz}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    router.refresh();
  }, [router]);

  return null;
}
