import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeTeamName } from "@/lib/team-name-aliases";

type RemoteMatch = {
  id: number;
  utcDate: string;
  status: string;
  homeTeam?: { name?: string | null } | null;
  awayTeam?: { name?: string | null } | null;
  score?: {
    fullTime?: { home: number | null; away: number | null } | null;
  } | null;
};

type LocalMatch = {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

type Summary = {
  fetched: number;
  matched: number;
  live: number;
  final: number;
  recomputed: number;
  unmatched: number;
  errors: number;
};

const FOOTBALL_DATA_URL =
  "https://api.football-data.org/v4/competitions/WC/matches?season=2026";

function unauthorized() {
  return new NextResponse("unauthorized", { status: 401 });
}

function skipped(reason: string) {
  return new NextResponse(null, {
    status: 204,
    headers: { "x-skipped": reason },
  });
}

export async function GET(request: NextRequest) {
  // 1. Auth: require Bearer ${CRON_SECRET}. In non-prod with no secret set, allow.
  const auth = request.headers.get("authorization");
  const isProd = process.env.NODE_ENV === "production";
  if (env.cronSecret) {
    if (auth !== `Bearer ${env.cronSecret}`) return unauthorized();
  } else if (isProd) {
    return skipped("missing-env");
  }

  // 2. Token gate.
  if (!env.footballDataToken) return skipped("missing-env");

  // 3. Fetch.
  const resp = await fetch(FOOTBALL_DATA_URL, {
    headers: { "X-Auth-Token": env.footballDataToken },
    // No Next caching for the cron source.
    cache: "no-store",
  });
  if (!resp.ok) {
    throw new Error(
      `Football-Data fetch failed: ${resp.status} ${resp.statusText}`,
    );
  }
  const body = (await resp.json()) as { matches?: RemoteMatch[] };
  const remote = body.matches ?? [];

  const summary: Summary = {
    fetched: remote.length,
    matched: 0,
    live: 0,
    final: 0,
    recomputed: 0,
    unmatched: 0,
    errors: 0,
  };

  // 4. Load all local matches once.
  const admin = createAdminSupabaseClient();
  const { data: localRows, error: loadErr } = await admin
    .from("matches")
    .select("id, home_team, away_team, kickoff_at, home_score, away_score, status");
  if (loadErr) {
    throw new Error(`Failed to load local matches: ${loadErr.message}`);
  }
  const locals = (localRows ?? []) as LocalMatch[];

  // Index local matches by (home|away|YYYY-MM-DD) for O(1) lookup.
  const byKey = new Map<string, LocalMatch>();
  for (const m of locals) {
    byKey.set(
      `${m.home_team}|${m.away_team}|${m.kickoff_at.slice(0, 10)}`,
      m,
    );
  }

  // 5. Walk remote, decide updates.
  for (const r of remote) {
    const home = normalizeTeamName(r.homeTeam?.name ?? null);
    const away = normalizeTeamName(r.awayTeam?.name ?? null);
    const date = (r.utcDate ?? "").slice(0, 10);
    if (!home || !away || !date) continue;

    const local = byKey.get(`${home}|${away}|${date}`);
    if (!local) {
      summary.unmatched++;
      console.warn(`[cron:sync-matches] unmatched remote: ${home} vs ${away} @ ${date}`);
      continue;
    }
    summary.matched++;

    const status = (r.status ?? "").toUpperCase();
    let touched = false;

    // FINISHED / AWARDED → write score + status='final'.
    if ((status === "FINISHED" || status === "AWARDED") &&
        r.score?.fullTime?.home != null &&
        r.score.fullTime.away != null) {
      const { error } = await admin
        .from("matches")
        .update({
          home_score: r.score.fullTime.home,
          away_score: r.score.fullTime.away,
          status: "final",
        })
        .eq("id", local.id);
      if (error) {
        summary.errors++;
        console.error(`[cron:sync-matches] update final failed for ${local.id}:`, error.message);
        continue;
      }
      summary.final++;
      touched = true;
    } else if ((status === "IN_PLAY" || status === "PAUSED") &&
               local.status !== "final" &&
               local.status !== "live") {
      // Flip to live, but never downgrade a final.
      const { error } = await admin
        .from("matches")
        .update({ status: "live" })
        .eq("id", local.id);
      if (error) {
        summary.errors++;
        console.error(`[cron:sync-matches] update live failed for ${local.id}:`, error.message);
        continue;
      }
      summary.live++;
      touched = true;
    }

    if (touched) {
      const { error: rpcErr } = await admin.rpc("compute_match_scores", {
        p_match_id: local.id,
      });
      if (rpcErr) {
        summary.errors++;
        console.error(`[cron:sync-matches] recompute failed for ${local.id}:`, rpcErr.message);
        continue;
      }
      summary.recomputed++;
    }
  }

  console.log(`[cron:sync-matches] summary:`, JSON.stringify(summary));
  return NextResponse.json(summary);
}
