import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createChatCompletion } from "@/lib/ai/openrouter";
import { generateMatchImagePrompt } from "@/lib/matches/match-image-prompt";
import { requestMatchImageRender } from "@/lib/matches/match-image-render";
import type { MatchEventType, MatchEventTeam } from "@/lib/matches/match-events";
import type { Database } from "@/lib/database.types";

// The summary generator runs server-side with the service-role admin client
// (RLS-bypassing) and calls OpenRouter. It is invoked from the result-sync flow
// after matches go final, isolated so a failure never blocks score writes.

type AdminClient = SupabaseClient<Database>;

const SUMMARY_LOCALE = "en";
const DEFAULT_STYLE_KEY = "neutral";
// Cap how many matches one batch pass will summarize, so a backlog (e.g. the
// first run after deploy) can't fan out into an unbounded burst of LLM calls.
const DEFAULT_BATCH_LIMIT = 20;

/**
 * Recap styles an admin can pick when regenerating. The instruction fragment is
 * appended to the base system prompt; `neutral` adds nothing (the base tone). A
 * free-text custom instruction is carried under the `custom` key instead.
 */
export const STYLE_PRESETS: Record<string, string> = {
  neutral: "",
  dramatic:
    "Lean into a dramatic, vivid tone — heighten the tension and the stakes — " +
    "while staying strictly factual and within the provided events and score.",
  tactical:
    "Emphasise the tactical story — momentum shifts, how the goals came, the " +
    "game state — staying strictly factual and within the provided events and score.",
  concise:
    "Be extra concise: at most two short sentences naming the result and the single key moment.",
};

/** The resolved style for one generation: a key plus the exact instruction used. */
export type SummaryStyle = { key: string; instruction: string | null };

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
  styleInstruction?: string | null,
): { system: string; user: string } {
  let system =
    "You are a football match reporter. Write a concise, factual recap in English " +
    "(2-4 sentences, ~60-90 words) of the match described below. Use ONLY the final " +
    "score and the timeline events provided — never invent goals, players, or details " +
    "not present. Name the key moments (goals, red cards) and who won. Neutral, " +
    "engaging tone. Output plain text only, no markdown or headings.";

  // Optional style guidance is appended AFTER the grounding constraints so the
  // "never invent facts / use only the provided data" rule still dominates.
  const style = styleInstruction?.trim();
  if (style) system += `\n\nStyle guidance (do not override the constraints above): ${style}`;

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
  reason?: "no-key" | "exists" | "missing" | "not-final" | "no-events";
  /** Id of the inserted version (regenerate mode), present on success. */
  summaryId?: string;
};

export type GenerateOptions = {
  /**
   * `auto` (default): idempotent — skip when the match already has any version;
   * the new recap is stored as the active (published) version. Used by the cron
   * pass and the management-list quick action.
   * `regenerate`: always insert a new NON-active draft version with the given
   * style, even when versions already exist. Used by the admin detail page.
   */
  mode?: "auto" | "regenerate";
  /** Style to apply; defaults to the neutral preset. */
  style?: SummaryStyle;
};

/**
 * Generate and persist a recap version for a single match. In `auto` mode it is
 * idempotent (skips when a version already exists or the match is not final) and
 * treats a unique-violation on the active slot (a concurrent run won the race) as
 * "exists". In `regenerate` mode it always inserts a new draft. Returns without a
 * network call when the OpenRouter key is unset.
 */
export async function generateMatchSummary(
  admin: AdminClient,
  matchId: string,
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  const mode = opts.mode ?? "auto";
  const style = opts.style ?? { key: DEFAULT_STYLE_KEY, instruction: null };

  // Gate on the key first so a dormant deploy never touches the DB or network.
  if (!env.openrouterApiKey) return { generated: false, reason: "no-key" };

  // Auto path stays idempotent: skip when the match already has ANY version.
  // (Multiple rows are now legal, so fetch up to one rather than maybeSingle.)
  if (mode === "auto") {
    const { data: existing } = await admin
      .from("match_summaries")
      .select("id")
      .eq("match_id", matchId)
      .limit(1);
    if (existing && existing.length > 0) return { generated: false, reason: "exists" };
  }

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

  // Require real event data: a recap built from the score alone is low value, so
  // skip (no LLM call, no insert) when no events were ingested. This gate is
  // authoritative for every path (cron, manual trigger, and regeneration).
  const events = (eventRows ?? []) as SummaryEvent[];
  if (events.length === 0) return { generated: false, reason: "no-events" };

  const prompt = buildSummaryPrompt(match as SummaryMatch, events, style.instruction);

  const completion = await createChatCompletion({
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
  });
  // Key was unset between the gate and here, or provider returned no client.
  if (!completion) return { generated: false, reason: "no-key" };

  // Auto path publishes its recap (active); regeneration stores a draft that the
  // admin must explicitly activate, so it never changes the public view.
  const isActive = mode === "auto";
  const { data: inserted, error } = await admin
    .from("match_summaries")
    .insert({
      match_id: matchId,
      content: completion.content,
      provider: "openrouter",
      model: completion.model,
      prompt_tokens: completion.promptTokens,
      completion_tokens: completion.completionTokens,
      locale: SUMMARY_LOCALE,
      style_key: style.key,
      style_instruction: style.instruction,
      is_active: isActive,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation on the active slot: a concurrent auto pass won
    // the race. Drafts carry no active-uniqueness, so this only fires for auto.
    if ((error as { code?: string }).code === "23505") {
      return { generated: false, reason: "exists" };
    }
    throw new Error(`Failed to store summary for ${matchId}: ${error.message}`);
  }

  // Best-effort: derive the comic-strip image prompt for the freshly published
  // recap. Only the auto (active) path; isolated in try/catch so a failure here
  // never blocks recap storage, score writes, or the surrounding sync.
  if (isActive && inserted?.id) {
    try {
      await generateMatchImagePrompt(admin, inserted.id);
    } catch (err) {
      console.error(`[match-summary] image prompt generation failed for ${matchId}:`, err);
    }
    // Then render that prompt to an image (Leonardo). Separate isolated step: it
    // reads the image_prompt the call above just stored, and no-ops when that
    // prompt is absent (the step above failed) or the Leonardo key is unset.
    try {
      await requestMatchImageRender(admin, inserted.id);
    } catch (err) {
      console.error(`[match-summary] image render request failed for ${matchId}:`, err);
    }
  }

  return { generated: true, summaryId: inserted?.id };
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
