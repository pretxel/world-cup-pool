"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

// Renders nothing; lets the /my-picks Server Component fire
// `picks_vs_results_viewed` once on mount. The ref guards against React Strict
// Mode double-invoking the effect in dev. Mirrors LeaderboardViewTracker.
export function PicksVsResultsTracker() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent("picks_vs_results_viewed");
  }, []);

  return null;
}
