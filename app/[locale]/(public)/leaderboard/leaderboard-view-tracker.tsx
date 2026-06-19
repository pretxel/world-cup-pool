"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

// Renders nothing; exists only so the Server Component leaderboard page can fire
// a `leaderboard_viewed` event once on mount. The ref guards against React Strict
// Mode double-invoking the effect in dev so the event fires exactly once.
export function LeaderboardViewTracker() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent("leaderboard_viewed");
  }, []);

  return null;
}
