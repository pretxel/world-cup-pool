import { NextResponse } from "next/server";
import { getActiveCompetition } from "@/lib/competition";
import { getLiveAndNextUp, type LiveMatchesPayload } from "@/lib/matches/live";

const EMPTY: LiveMatchesPayload = { live: [], nextUp: null };

// Polled ~30s by the landing page's <LiveMatchList/>. Reads live + next-up
// fixtures for the active competition. `no-store` keeps every poll fresh; a
// missing active competition or any error degrades to an empty payload so the
// client just shows nothing rather than erroring.
export async function GET() {
  try {
    const competition = await getActiveCompetition();
    const data = await getLiveAndNextUp(competition?.id);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(EMPTY, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
