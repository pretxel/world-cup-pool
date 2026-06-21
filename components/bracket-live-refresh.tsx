"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

// Collapse a burst of match-row changes (e.g. a sync run finalizing several
// rows) into a single server refresh.
const REFRESH_DEBOUNCE_MS = 750;

// Invisible live-refresh trigger for the bracket page. On mount it subscribes
// to Realtime change events on the public.matches base table and calls
// router.refresh() (debounced) so the server-rendered bracket re-renders
// without a manual reload. The server stays the single source of truth for
// allocation, provisional projections, and match-number resolution — this
// component never re-derives the bracket on the client. If Realtime never
// connects or subscribing throws, it silently no-ops and the page still
// renders and updates on normal reload/navigation.
export function BracketLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Debounce so a burst of match writes coalesces into one refresh.
    function scheduleRefresh() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    }

    let channel: ReturnType<
      ReturnType<typeof createBrowserSupabaseClient>["channel"]
    > | null = null;
    const supabase = createBrowserSupabaseClient();

    try {
      channel = supabase
        .channel("bracket-matches")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "matches" },
          scheduleRefresh,
        )
        .subscribe();
    } catch {
      // Silent fallback: keep the SSR bracket; it still updates on reload.
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
