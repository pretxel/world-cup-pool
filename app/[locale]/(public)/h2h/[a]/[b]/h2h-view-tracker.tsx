"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

// Renders nothing; exists only so the Server Component head-to-head page can
// fire a `h2h_view` event once on mount. The ref guards against React Strict
// Mode double-invoking the effect in dev so the event fires exactly once.
// Fire-and-forget: trackEvent is a no-op when analytics is unavailable, so it
// never blocks or breaks the render.
export function H2HViewTracker() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent("h2h_view");
  }, []);

  return null;
}
