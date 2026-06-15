import { normalizeTeamName } from "@/lib/team-name-aliases";
import type { Json } from "@/lib/database.types";
import type { ProviderConfig } from "@/lib/result-sync/types";
import type {
  MatchEventTeam,
  MatchEventType,
} from "@/lib/matches/match-events";

// ESPN's keyless summary endpoint carries play-by-play ("key events") that the
// scoreboard does not. To reach it we first resolve the match's ESPN event id
// off the scoreboard, then read its summary. Both are derived from the active
// competition's `providers.espn.leaguePath` (same config the score sync uses),
// never hardcoded.
const DEFAULT_LEAGUE_PATH = "fifa.world";

function leaguePath(config?: ProviderConfig): string {
  return config?.espn?.leaguePath ?? DEFAULT_LEAGUE_PATH;
}

function espnBase(config?: ProviderConfig): string {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${leaguePath(config)}`;
}

function compactDate(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function addUtcDays(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

export type MatchRef = {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
};

export type NormalizedEspnEvent = {
  providerEventId: string;
  type: MatchEventType;
  team: MatchEventTeam;
  minute: number | null;
  extraMinute: number | null;
  sequence: number;
  player: string | null;
  detail: string | null;
  payload: Json;
};

type ScoreboardCompetitor = {
  homeAway?: string;
  team?: { displayName?: string | null } | null;
};

type ScoreboardEvent = {
  id?: string;
  date?: string;
  competitions?: Array<{ competitors?: ScoreboardCompetitor[] | null }> | null;
};

// Resolve the ESPN event id for a local match by matching team names + date on
// the scoreboard (same normalization the score sync uses). Returns null when
// the match is not on ESPN's board for that day.
export async function resolveEspnEventId(
  match: MatchRef,
  config?: ProviderConfig,
): Promise<string | null> {
  const date = match.kickoff_at.slice(0, 10);
  // ESPN buckets days by US Eastern, so widen one day back (same as the
  // scoreboard provider) to cover late-night UTC kickoffs.
  const from = compactDate(addUtcDays(date, -1));
  const to = compactDate(date);
  const range = from === to ? from : `${from}-${to}`;

  const resp = await fetch(`${espnBase(config)}/scoreboard?dates=${range}`, {
    cache: "no-store",
  });
  if (!resp.ok) {
    throw new Error(
      `ESPN scoreboard fetch failed for ${range}: ${resp.status} ${resp.statusText}`,
    );
  }
  const body = (await resp.json()) as { events?: ScoreboardEvent[] };
  const wantHome = normalizeTeamName(match.home_team);
  const wantAway = normalizeTeamName(match.away_team);

  for (const event of body.events ?? []) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const eventHome = normalizeTeamName(home?.team?.displayName ?? null);
    const eventAway = normalizeTeamName(away?.team?.displayName ?? null);
    if (eventHome === wantHome && eventAway === wantAway && event.id) {
      return String(event.id);
    }
  }
  return null;
}

type SummaryCompetitor = {
  id?: string;
  homeAway?: string;
  team?: { id?: string | null } | null;
};

type KeyEvent = {
  id?: string | number;
  type?: { id?: string; text?: string | null } | null;
  text?: string | null;
  scoringPlay?: boolean;
  clock?: { displayValue?: string | null } | null;
  time?: { displayValue?: string | null } | null;
  period?: { number?: number | null } | null;
  team?: { id?: string | null } | null;
  athletesInvolved?: Array<{ displayName?: string | null }> | null;
  participants?: Array<{ athlete?: { displayName?: string | null } | null }> | null;
};

function parseClock(disp: string | null | undefined): {
  minute: number | null;
  extraMinute: number | null;
} {
  if (!disp) return { minute: null, extraMinute: null };
  const m = disp.match(/(\d+)(?:\s*\+\s*(\d+))?/);
  if (!m) return { minute: null, extraMinute: null };
  return {
    minute: Number(m[1]),
    extraMinute: m[2] != null ? Number(m[2]) : null,
  };
}

// Map ESPN's free-text event labels onto the normalized type enum. ESPN is not
// perfectly consistent, so we lean on `scoringPlay` plus keyword heuristics and
// fall back to `other` (the raw payload is retained for later reconciliation).
export function mapEventType(
  typeText: string,
  scoringPlay: boolean,
  detail: string | null,
): MatchEventType {
  const text = `${typeText} ${detail ?? ""}`.toLowerCase();
  const has = (s: string) => text.includes(s);

  if (has("own goal")) return "own_goal";
  if (has("penalty")) {
    if (has("miss") || has("saved")) return "penalty_missed";
    if (scoringPlay || has("goal") || has("scored")) return "penalty_goal";
  }
  if (scoringPlay || has("goal")) return "goal";
  if (has("yellow")) {
    if (has("second") || has("red")) return "yellow_red";
    return "yellow";
  }
  if (has("red")) return "red";
  if (has("substitut") || has("sub ")) return "substitution";
  if (has("var") || has("review")) return "var";
  if (has("kickoff") || has("kick-off") || has("start") || has("begin")) {
    return "period_start";
  }
  if (
    has("end") ||
    has("half-time") ||
    has("halftime") ||
    has("half time") ||
    has("full-time") ||
    has("full time")
  ) {
    return "period_end";
  }
  return "other";
}

export function normalizeEspnKeyEvents(
  keyEvents: KeyEvent[],
  competitors: SummaryCompetitor[],
): NormalizedEspnEvent[] {
  const teamSide = new Map<string, MatchEventTeam>();
  for (const c of competitors) {
    const id = c.team?.id != null ? String(c.team.id) : c.id != null ? String(c.id) : null;
    const side = c.homeAway === "home" ? "home" : c.homeAway === "away" ? "away" : null;
    if (id && side) teamSide.set(id, side);
  }

  const out: NormalizedEspnEvent[] = [];
  keyEvents.forEach((ke, index) => {
    const typeText = ke.type?.text ?? "";
    const scoringPlay = ke.scoringPlay === true;
    const detail = ke.text ?? ke.type?.text ?? null;
    const { minute, extraMinute } = parseClock(
      ke.clock?.displayValue ?? ke.time?.displayValue,
    );
    const teamId = ke.team?.id != null ? String(ke.team.id) : null;
    const team = teamId ? (teamSide.get(teamId) ?? null) : null;
    const player =
      ke.athletesInvolved?.[0]?.displayName ??
      ke.participants?.[0]?.athlete?.displayName ??
      null;
    const type = mapEventType(typeText, scoringPlay, detail);

    // Idempotency key. Prefer ESPN's play id; synthesize a stable key from the
    // event's intrinsic fields (not array index) when absent, so re-syncs that
    // reorder/insert events still upsert in place.
    const providerEventId =
      ke.id != null
        ? String(ke.id)
        : `synth:${ke.type?.id ?? type}:${minute ?? "x"}:${extraMinute ?? 0}:${teamId ?? "n"}`;

    // Ordering within the match. minute is cumulative across halves in soccer,
    // so minute*1000+extra is chronological; pre-kickoff entries (no minute)
    // keep their small array index, sorting them ahead of in-match events.
    const sequence =
      minute != null ? minute * 1000 + (extraMinute ?? 0) : index;

    out.push({
      providerEventId,
      type,
      team,
      minute,
      extraMinute,
      sequence,
      player,
      detail,
      payload: ke as Json,
    });
  });
  return out;
}

export async function fetchEspnMatchEvents(
  eventId: string,
  config?: ProviderConfig,
): Promise<NormalizedEspnEvent[]> {
  // Encode the event id via URLSearchParams rather than string interpolation:
  // it comes from ESPN's response cast to a string, so don't trust it to be
  // free of URL metacharacters.
  const url = new URL(`${espnBase(config)}/summary`);
  url.searchParams.set("event", eventId);
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(
      `ESPN summary fetch failed for ${eventId}: ${resp.status} ${resp.statusText}`,
    );
  }
  const body = (await resp.json()) as {
    keyEvents?: KeyEvent[];
    plays?: KeyEvent[];
    header?: {
      competitions?: Array<{ competitors?: SummaryCompetitor[] | null }> | null;
    } | null;
  };
  const keyEvents = body.keyEvents ?? body.plays ?? [];
  const competitors = body.header?.competitions?.[0]?.competitors ?? [];
  return normalizeEspnKeyEvents(keyEvents, competitors);
}
