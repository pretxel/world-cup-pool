import { NextResponse } from "next/server";
import { getActiveCompetition } from "@/lib/competition";
import { getLiveAndNextUp, type LiveMatchesPayload } from "@/lib/matches/live";
import { maybeScheduleMatchSync } from "@/lib/result-sync/opportunistic";

const EMPTY: LiveMatchesPayload = { live: [], nextUp: null };

// Cap how many live fixtures we schedule a sync for per request. The section
// shows at most a handful of rows; this bounds provider fan-out if an unusually
// large slate is live at once.
const LANDING_SYNC_CAP = 6;

// Polled ~30s by the landing page's <LiveMatchList/>. Reads live + next-up
// fixtures for the active competition. `no-store` keeps every poll fresh; a
// missing active competition or any error degrades to an empty payload so the
// client just shows nothing rather than erroring.
//
// Landing is the only ~30s path hit by every visitor, yet it otherwise just
// reads the matches table — so live scores sit at their seeded value between
// cron runs. Mirror the per-match live route: schedule a throttled, non-blocking
// result sync for the currently-live fixtures so the scores this section polls
// actually advance. `maybeScheduleMatchSync` self-schedules via `after()` (not
// awaited here), skips terminal fixtures, and its 15s per-match throttle —
// shared with the per-match route — collapses concurrent visitors to ~one
// provider fetch per fixture per window. Only `data.live` is scheduled, never
// the next-up fallback.
export async function GET() {
  try {
    const competition = await getActiveCompetition();
    const data = await getLiveAndNextUp(competition?.id);
    try {
      for (const fixture of data.live.slice(0, LANDING_SYNC_CAP)) {
        maybeScheduleMatchSync({ id: fixture.id, status: fixture.status });
      }
    } catch {
      // Scheduling is best-effort; never let it drop the live payload.
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(EMPTY, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
