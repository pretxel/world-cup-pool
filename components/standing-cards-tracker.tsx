"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

// Renders nothing; lets a Server Component fire `standing_cards_viewed` once on
// mount. The ref guards against React Strict Mode double-invoking the effect in
// dev so the event fires exactly once. Mirrors LeaderboardViewTracker.
export function StandingCardsTracker() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent("standing_cards_viewed");
  }, []);

  return null;
}
