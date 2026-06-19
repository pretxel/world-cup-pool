"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  LeaderboardTable,
  type BoardRow,
  type LeaderboardLabels,
} from "@/components/leaderboard-table";

// How many rows the board renders (matches the SSR slice in the page).
const TOP_N = 10;
// Collapse the burst of per-user score rows written when one match is computed
// into a single v_leaderboard_overall re-fetch.
const REFETCH_DEBOUNCE_MS = 750;

// Live wrapper around the presentational LeaderboardTable. Seeded by the SSR
// rows, it subscribes to Realtime change events on the public.scores base table
// and re-fetches v_leaderboard_overall on change so the standings update without
// a manual reload. The view stays the source of truth for ranks, tie-breaks,
// and admin exclusion — this component never re-derives ranks on the client.
// If Realtime never connects or a re-fetch errors, it silently keeps the
// initial SSR rows.
export function LeaderboardLive({
  initialRows,
  currentUserId,
  labels,
}: {
  initialRows: BoardRow[];
  currentUserId?: string | null;
  labels: LeaderboardLabels;
}) {
  const [rows, setRows] = useState<BoardRow[]>(initialRows);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refetch() {
      const { data, error } = await supabase
        .from("v_leaderboard_overall")
        .select("*")
        .order("rank", { ascending: true });
      // Silent fallback: keep the current rows on any error so the page never
      // surfaces a realtime failure to the user.
      if (cancelled || error || !data) return;
      setRows((data as BoardRow[]).slice(0, TOP_N));
    }

    // Debounce so a burst of score writes from one computed match coalesces
    // into a single view query.
    function scheduleRefetch() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refetch, REFETCH_DEBOUNCE_MS);
    }

    const channel = supabase
      .channel("leaderboard-scores")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores" },
        scheduleRefetch,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <LeaderboardTable
      rows={rows}
      currentUserId={currentUserId}
      labels={labels}
    />
  );
}
