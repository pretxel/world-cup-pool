import type { RemoteMatch, ResultProvider } from "@/lib/result-sync/types";

// Keyless fallback source. ESPN's unofficial scoreboard returns one UTC day
// per request, so callers must pass the dates they care about; core.ts derives
// them from the local matches that could plausibly have a result.
const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

type EspnCompetitor = {
  homeAway?: string;
  score?: string | null;
  team?: { displayName?: string | null } | null;
};

type EspnEvent = {
  id?: string;
  date?: string;
  status?: {
    type?: { state?: string; completed?: boolean } | null;
  } | null;
  competitions?: Array<{ competitors?: EspnCompetitor[] | null }> | null;
};

function compactDate(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function addUtcDays(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function toScore(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// ESPN state machine: `state` is "pre" | "in" | "post". Map onto the
// Football-Data vocabulary RemoteMatch uses so core.ts needs no special cases.
function toRemoteStatus(state: string | undefined, completed: boolean | undefined): string {
  if (state === "post" && completed) return "FINISHED";
  if (state === "in") return "IN_PLAY";
  return "SCHEDULED";
}

export function normalizeEspnEvents(events: EspnEvent[]): RemoteMatch[] {
  const out: RemoteMatch[] = [];
  for (const event of events) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home?.team?.displayName || !away?.team?.displayName || !event.date) {
      continue;
    }
    const status = toRemoteStatus(
      event.status?.type?.state,
      event.status?.type?.completed,
    );
    out.push({
      id: Number(event.id ?? 0),
      // ESPN dates omit seconds ("2026-06-11T19:00Z"); the pipeline only
      // slices the date portion, so pass through as-is.
      utcDate: event.date,
      status,
      homeTeam: { name: home.team.displayName },
      awayTeam: { name: away.team.displayName },
      score:
        status === "FINISHED"
          ? { fullTime: { home: toScore(home.score), away: toScore(away.score) } }
          : null,
    });
  }
  return out;
}

export const espnProvider: ResultProvider = {
  name: "espn",

  // Keyless — always available.
  available() {
    return true;
  },

  async fetchMatches(dates: string[] = []): Promise<RemoteMatch[]> {
    if (dates.length === 0) return [];
    // ESPN buckets days by US Eastern time, not UTC: a UTC date D's
    // late-night kickoffs (00:00–04:00Z) live under Eastern day D-1
    // (verified live: 2026-06-13T01:00Z is served by dates=20260612, not
    // 20260613). Widen the range one day back so UTC-dated targets are
    // always covered; extra events are matched by their own utcDate or
    // logged as unmatched.
    const sorted = [...dates].sort();
    const from = compactDate(addUtcDays(sorted[0], -1));
    const to = compactDate(sorted[sorted.length - 1]);
    const range = from === to ? from : `${from}-${to}`;
    const resp = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${range}`, {
      cache: "no-store",
    });
    if (!resp.ok) {
      throw new Error(
        `ESPN fetch failed for ${range}: ${resp.status} ${resp.statusText}`,
      );
    }
    const body = (await resp.json()) as { events?: EspnEvent[] };
    return normalizeEspnEvents(body.events ?? []);
  },
};
