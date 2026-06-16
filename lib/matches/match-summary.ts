import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createChatCompletion } from "@/lib/ai/openrouter";
import type { MatchEventType, MatchEventTeam } from "@/lib/matches/match-events";
import type { Database } from "@/lib/database.types";

// The summary generator runs server-side with the service-role admin client
// (RLS-bypassing) and calls OpenRouter. It is invoked from the result-sync flow
// after matches go final, isolated so a failure never blocks score writes.

type AdminClient = SupabaseClient<Database>;

const SUMMARY_LOCALE = "en";
// Cap how many matches one batch pass will summarize, so a backlog (e.g. the
// first run after deploy) can't fan out into an unbounded burst of LLM calls.
const DEFAULT_BATCH_LIMIT = 20;

/** Match fields the prompt needs. */
export type SummaryMatch = {
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  stage: string | null;
  group_code: string | null;
};

/** Event fields the prompt needs (ordered by `sequence`). */
export type SummaryEvent = {
  type: MatchEventType | string;
  team: MatchEventTeam;
  minute: number | null;
  extra_minute: number | null;
  player: string | null;
  detail: string | null;
};

const EVENT_LABELS: Record<string, string> = {
  goal: "Goal",
  own_goal: "Own goal",
  penalty_goal: "Penalty goal",
  penalty_missed: "Penalty missed",
  yellow: "Yellow card",
  red: "Red card",
  yellow_red: "Second yellow (sent off)",
  substitution: "Substitution",
  period_start: "Period start",
  period_end: "Period end",
  var: "VAR review",
  other: "Update",
};

function formatMinute(minute: number | null, extra: number | null): string {
  if (minute == null) return "—";
  return extra != null && extra > 0 ? `${minute}+${extra}'` : `${minute}'`;
}

function teamLabel(match: SummaryMatch, team: MatchEventTeam): string {
  if (team === "home") return match.home_team;
  if (team === "away") return match.away_team;
  return "—";
}

/**
 * Build the system + user messages for the recap. Pure and exported so the
 * prompt shape is unit-testable without a network call. The model is told to
 * stay strictly within the provided events and score — no invented facts.
 */
export function buildSummaryPrompt(
  match: SummaryMatch,
  events: SummaryEvent[],
): { system: string; user: string } {
  const system =
    "You are a football match reporter. Write a concise, factual recap in English " +
    "(2-4 sentences, ~60-90 words) of the match described below. Use ONLY the final " +
    "score and the timeline events provided — never invent goals, players, or details " +
    "not present. Name the key moments (goals, red cards) and who won. Neutral, " +
    "engaging tone. Output plain text only, no markdown or headings.";

  const stageBits = [match.stage, match.group_code].filter(Boolean).join(" · ");
  const header = [
    `Match: ${match.home_team} vs ${match.away_team}`,
    stageBits ? `Stage: ${stageBits}` : null,
    `Final score: ${match.home_team} ${match.home_score ?? 0} - ${match.away_score ?? 0} ${match.away_team}`,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = events.map((e) => {
    const label = EVENT_LABELS[e.type] ?? e.type;
    const who = e.player ? ` — ${e.player}` : "";
    const side = e.team ? ` (${teamLabel(match, e.team)})` : "";
    const detail = e.detail ? ` [${e.detail}]` : "";
    return `${formatMinute(e.minute, e.extra_minute)} ${label}${side}${who}${detail}`;
  });

  const timeline =
    lines.length > 0
      ? `Timeline:\n${lines.join("\n")}`
      : "Timeline: no individual events were recorded for this match.";

  return { system, user: `${header}\n\n${timeline}` };
}

export type GenerateResult = {
  generated: boolean;
  reason?: "no-key" | "exists" | "missing" | "not-final";
};

/**
 * Generate and persist the recap for a single match. Idempotent: skips when a
 * summary already exists or the match is not final, and treats a unique-violation
 * on insert (a concurrent run won the race) as "exists", not an error. Returns
 * without a network call when the OpenRouter key is unset.
 */
export async function generateMatchSummary(
  admin: AdminClient,
  matchId: string,
): Promise<GenerateResult> {
  // Gate on the key first so a dormant deploy never touches the DB or network.
  if (!env.openrouterApiKey) return { generated: false, reason: "no-key" };

  const { data: existing } = await admin
    .from("match_summaries")
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (existing) return { generated: false, reason: "exists" };

  const { data: match } = await admin
    .from("matches")
    .select("home_team, away_team, home_score, away_score, status, stage, group_code")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { generated: false, reason: "missing" };
  if (match.status !== "final") return { generated: false, reason: "not-final" };

  const { data: eventRows } = await admin
    .from("match_events")
    .select("type, team, minute, extra_minute, player, detail")
    .eq("match_id", matchId)
    .order("sequence", { ascending: true });

  const prompt = buildSummaryPrompt(match as SummaryMatch, (eventRows ?? []) as SummaryEvent[]);

  const completion = await createChatCompletion({
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
  });
  // Key was unset between the gate and here, or provider returned no client.
  if (!completion) return { generated: false, reason: "no-key" };

  const { error } = await admin.from("match_summaries").insert({
    match_id: matchId,
    content: completion.content,
    provider: "openrouter",
    model: completion.model,
    prompt_tokens: completion.promptTokens,
    completion_tokens: completion.completionTokens,
    locale: SUMMARY_LOCALE,
  });

  if (error) {
    // 23505 = unique_violation: a concurrent pass inserted first. Not an error.
    if ((error as { code?: string }).code === "23505") {
      return { generated: false, reason: "exists" };
    }
    throw new Error(`Failed to store summary for ${matchId}: ${error.message}`);
  }

  return { generated: true };
}

export type PendingSummary = {
  candidates: number;
  generated: number;
  skipped: number;
  errors: number;
};

/**
 * Find final matches that lack a summary and generate one for each. Used by the
 * sync flow after results are written, and reusable as a backfill. No-ops
 * (without DB access) when the OpenRouter key is unset.
 */
export async function generatePendingSummaries(
  admin: AdminClient,
  opts: { limit?: number } = {},
): Promise<PendingSummary> {
  const out: PendingSummary = { candidates: 0, generated: 0, skipped: 0, errors: 0 };
  if (!env.openrouterApiKey) return out;

  const limit = opts.limit ?? DEFAULT_BATCH_LIMIT;

  const { data: finals, error } = await admin
    .from("matches")
    .select("id")
    .eq("status", "final")
    .order("kickoff_at", { ascending: false })
    .limit(limit);
  if (error) {
    out.errors++;
    console.error("[match-summary] failed to load final matches:", error.message);
    return out;
  }

  const ids = (finals ?? []).map((m) => m.id);
  if (ids.length === 0) return out;

  // Diff against existing summaries in one query (PostgREST has no clean
  // anti-join), then generate only the missing ones.
  const { data: existing } = await admin
    .from("match_summaries")
    .select("match_id")
    .in("match_id", ids);
  const have = new Set((existing ?? []).map((r) => r.match_id));
  const pending = ids.filter((id) => !have.has(id));
  out.candidates = pending.length;

  for (const id of pending) {
    try {
      const result = await generateMatchSummary(admin, id);
      if (result.generated) out.generated++;
      else out.skipped++;
    } catch (err) {
      out.errors++;
      console.error(`[match-summary] generation failed for ${id}:`, err);
    }
  }

  return out;
}
