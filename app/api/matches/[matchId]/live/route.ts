import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isLiveNow } from "@/lib/matches/live";
import { maybeScheduleMatchSync } from "@/lib/result-sync/opportunistic";
import type {
  LiveFeedPayload,
  MatchEvent,
  MatchEventTeam,
  MatchEventType,
} from "@/lib/matches/match-events";

// Per-match live feed. Polled ~15s by <LiveEventsFeed/> while a match is in
// progress. Returns current score/status plus the chronological event timeline.
// `no-store` keeps every poll fresh; an unknown id is a 404. When the match is
// live, schedules a debounced ESPN event+score refresh AFTER the response is
// sent so the feed stays fresh without a paid sub-minute cron.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: match } = await supabase
    .from("matches")
    .select("id, status, home_score, away_score, kickoff_at")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) {
    return new NextResponse("not found", { status: 404 });
  }

  const { data: rows } = await supabase
    .from("match_events")
    .select("id, type, team, minute, extra_minute, sequence, player, detail")
    .eq("match_id", matchId)
    .order("sequence", { ascending: true });

  const events: MatchEvent[] = (rows ?? []).map((r) => ({
    id: r.id,
    type: r.type as MatchEventType,
    team: r.team as MatchEventTeam,
    minute: r.minute,
    extraMinute: r.extra_minute,
    player: r.player,
    detail: r.detail,
    sequence: r.sequence,
  }));

  const isLive = isLiveNow(match);

  const payload: LiveFeedPayload = {
    matchId: match.id,
    status: match.status,
    homeScore: match.home_score,
    awayScore: match.away_score,
    kickoffAt: match.kickoff_at,
    isLive,
    updatedAt: new Date().toISOString(),
    events,
  };

  // Opportunistic refresh for in-progress matches only — terminal matches and
  // not-yet-kicked-off matches never schedule a sync.
  if (isLive) {
    maybeScheduleMatchSync({ id: match.id, status: match.status });
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
