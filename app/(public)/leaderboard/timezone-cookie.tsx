"use client";

import { useEffect } from "react";

export function TimezoneCookie() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const existing = document.cookie
        .split("; ")
        .find((c) => c.startsWith("tz="))
        ?.split("=")[1];
      if (existing !== tz) {
        // 1 year, root path
        document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      }
    } catch {
      // ignore
    }
  }, []);
  return null;
}
