// Shared, client-safe match-event types + helpers.
// No server-only imports here: this module is consumed by both the sync
// (server) and the live feed (client component).

export const MATCH_EVENT_TYPES = [
  "goal",
  "own_goal",
  "penalty_goal",
  "penalty_missed",
  "yellow",
  "red",
  "yellow_red",
  "substitution",
  "period_start",
  "period_end",
  "var",
  "other",
] as const;

export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];

export type MatchEventTeam = "home" | "away" | null;

/** A single timeline event as exposed by the live API to the client. */
export type MatchEvent = {
  id: string;
  type: MatchEventType;
  team: MatchEventTeam;
  minute: number | null;
  extraMinute: number | null;
  player: string | null;
  detail: string | null;
  sequence: number;
};

export type LiveFeedPayload = {
  matchId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: string;
  isLive: boolean;
  updatedAt: string;
  events: MatchEvent[];
};

const GOAL_TYPES = new Set<MatchEventType>(["goal", "penalty_goal"]);

export function isGoalType(type: MatchEventType): boolean {
  return GOAL_TYPES.has(type) || type === "own_goal";
}

/**
 * Derive the running score from goal events. The `matches` row only stores a
 * final aggregate score, so during a live match the authoritative running
 * score is the one implied by the goal events in the feed itself — keeping the
 * displayed score consistent with the timeline a user sees. An own goal counts
 * for the opposing team.
 */
export function deriveLiveScore(events: MatchEvent[]): {
  home: number;
  away: number;
} {
  let home = 0;
  let away = 0;
  for (const event of events) {
    if (event.team == null) continue;
    if (GOAL_TYPES.has(event.type)) {
      if (event.team === "home") home += 1;
      else away += 1;
    } else if (event.type === "own_goal") {
      // own goal credits the other side
      if (event.team === "home") away += 1;
      else home += 1;
    }
  }
  return { home, away };
}

/**
 * Score to display in the feed: final matches use the authoritative aggregate
 * from `matches`; in-progress matches derive it from goal events.
 */
export function displayScore(payload: LiveFeedPayload): {
  home: number | null;
  away: number | null;
} {
  if (payload.status === "final" && payload.homeScore != null) {
    return { home: payload.homeScore, away: payload.awayScore };
  }
  const derived = deriveLiveScore(payload.events);
  // Before kickoff with no events, show nothing rather than 0–0.
  if (payload.events.length === 0 && !payload.isLive) {
    return { home: null, away: null };
  }
  return derived;
}
