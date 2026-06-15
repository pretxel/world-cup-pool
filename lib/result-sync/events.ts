import type { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ProviderConfig } from "@/lib/result-sync/types";
import {
  fetchEspnMatchEvents,
  resolveEspnEventId,
  type MatchRef,
  type NormalizedEspnEvent,
} from "@/lib/result-sync/providers/espn-events";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

const PROVIDER = "espn";

// Idempotent persistence: upsert on the unique (match_id, provider,
// provider_event_id) key so re-ingesting the same ESPN payload updates rows in
// place rather than duplicating them.
export async function ingestMatchEvents(
  admin: AdminClient,
  matchId: string,
  events: NormalizedEspnEvent[],
): Promise<number> {
  if (events.length === 0) return 0;
  const rows = events.map((e) => ({
    match_id: matchId,
    provider: PROVIDER,
    provider_event_id: e.providerEventId,
    type: e.type,
    team: e.team,
    minute: e.minute,
    extra_minute: e.extraMinute,
    sequence: e.sequence,
    player: e.player,
    detail: e.detail,
    payload: e.payload,
  }));
  const { error } = await admin
    .from("match_events")
    .upsert(rows, { onConflict: "match_id,provider,provider_event_id" });
  if (error) {
    throw new Error(`match_events upsert failed: ${error.message}`);
  }
  return rows.length;
}

// Resolve one match's ESPN event id, fetch its play-by-play, and persist it.
// Returns the number of rows upserted (0 when the match is not on ESPN's board
// or has no events yet). Throws on fetch/parse/write errors — callers isolate.
export async function syncMatchEvents(
  admin: AdminClient,
  match: MatchRef,
  config?: ProviderConfig,
): Promise<number> {
  const eventId = await resolveEspnEventId(match, config);
  if (!eventId) return 0;
  const events = await fetchEspnMatchEvents(eventId, config);
  return ingestMatchEvents(admin, match.id, events);
}

// Ingest events for every currently-live match. Each match is isolated so one
// failure never aborts the rest; returns the total rows upserted. Used by the
// daily cron's isolated event step.
export async function syncLiveEvents(
  admin: AdminClient,
  competitionId?: string,
  config?: ProviderConfig,
): Promise<number> {
  let query = admin
    .from("matches")
    .select("id, home_team, away_team, kickoff_at")
    .eq("status", "live");
  if (competitionId) query = query.eq("competition_id", competitionId);
  const { data, error } = await query;
  if (error) {
    throw new Error(`load live matches failed: ${error.message}`);
  }
  let total = 0;
  for (const match of data ?? []) {
    try {
      total += await syncMatchEvents(admin, match, config);
    } catch (err) {
      console.error(`[result-sync:events] failed for ${match.id}:`, err);
    }
  }
  return total;
}
