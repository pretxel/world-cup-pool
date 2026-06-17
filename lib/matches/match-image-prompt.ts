import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createChatCompletion } from "@/lib/ai/openrouter";
import type { Database } from "@/lib/database.types";
import type { SummaryMatch } from "@/lib/matches/match-summary";

// Turns a stored recap (`match_summaries.content`) into a ready-to-render image
// prompt: a fixed 90s-anime comic-strip template whose ART STYLE / CHARACTER
// DESIGN / TECHNICAL SPECIFICATIONS sections are emitted verbatim by THIS code,
// while OpenRouter generates only the four-panel PANEL LAYOUT & SCENE SEQUENCE
// from the recap. Generating the panels (not the whole prompt) guarantees the
// fixed sections can never drift. Server-only and isolated like match-summary.

type AdminClient = SupabaseClient<Database>;

// The recap prompt is text-only; the comic prompt is longer (four panels + the
// fixed template), so give the completion more room than the recap's 320.
const IMAGE_PROMPT_MAX_TOKENS = 800;

/**
 * The verbatim, fixed part of the comic prompt — everything up to and including
 * the `PANEL LAYOUT & SCENE SEQUENCE` heading. The model-generated panels are
 * appended after this. Exported so tests can assert it is preserved unchanged.
 */
export const IMAGE_PROMPT_TEMPLATE_HEADER = `# 90s Anime Comic Strip Generation Prompt

### **ART STYLE:**
90s anime style, hand-drawn aesthetic, retro cel-shading, rich ink outlines, soft grain filter, vintage color palette with vibrant neon accents and warm gradients, nostalgic cinematic lighting, classic mecha/cyberpunk anime atmosphere.

### **CHARACTER DESIGN:**
- **Kenji:** A 17-year-old anime protagonist, spiky dark blue hair, wearing an oversized green bomber jacket over a white t-shirt, wearing a retro digital wristwatch. Expressive large eyes typical of 1990s animation.

### **TECHNICAL SPECIFICATIONS:**
Comic book page layout, 4-panel grid, scanline effect, 1990s anime OVA screencap quality, crisp details, 8k resolution, aspect ratio 2:3.

### **PANEL LAYOUT & SCENE SEQUENCE:**`;

/** Assemble the final prompt: fixed header verbatim + the generated panels. */
export function assembleImagePrompt(panels: string): string {
  return `${IMAGE_PROMPT_TEMPLATE_HEADER}\n${panels.trim()}\n`;
}

function matchHeader(match: SummaryMatch): string {
  const stageBits = [match.stage, match.group_code].filter(Boolean).join(" · ");
  return [
    `Match: ${match.home_team} vs ${match.away_team}`,
    stageBits ? `Stage: ${stageBits}` : null,
    `Final score: ${match.home_team} ${match.home_score ?? 0} - ${match.away_score ?? 0} ${match.away_team}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build the system + user messages that ask the model for ONLY the four-panel
 * scene sequence. Pure and exported so the prompt shape is unit-testable without
 * a network call. The model is constrained to the recap + match facts — it must
 * not invent goals, players, or scores absent from the recap.
 */
export function buildImagePromptMessages(
  content: string,
  match: SummaryMatch,
): { system: string; user: string } {
  const system =
    "You adapt a football match recap into a four-panel 90s-anime comic strip. " +
    "Output ONLY the PANEL LAYOUT & SCENE SEQUENCE: exactly four panels, numbered 1 to 4, " +
    "each in EXACTLY this format and nothing else:\n" +
    '### **Panel N**\n* **Visual:** <vivid 90s-anime description of the scene>\n* **Narration Box:** "<one short caption>"\n\n' +
    "The recurring protagonist Kenji (a 17-year-old anime fan, spiky dark blue hair, green bomber jacket) " +
    "watches and reacts to the match across the panels. Ground every panel STRICTLY in the recap and the " +
    "match facts below — depict the real result and the key moments (goals, red cards, who won) and name the " +
    "actual teams; never invent goals, players, or scores not present in the recap. Build the four panels as a " +
    "mini arc: kickoff/tension, a turning point, the decisive moment, the final result and Kenji's reaction. " +
    "Do not output the ART STYLE, CHARACTER DESIGN, or TECHNICAL SPECIFICATIONS sections — only the four panels.";

  const user = `${matchHeader(match)}\n\nMatch recap:\n${content.trim()}`;

  return { system, user };
}

export type GenerateImagePromptResult = {
  generated: boolean;
  reason?: "no-key" | "missing" | "empty-content";
};

/**
 * Generate and persist the image prompt for a single recap version. Reads the
 * version's `content` and its match, asks OpenRouter for the four panels, and
 * writes the assembled prompt to `image_prompt`. Returns without a network call
 * when `OPENROUTER_API_KEY` is unset (`no-key`). Throws only on a configured-key
 * provider failure or a DB write error, so callers decide how to react.
 */
export async function generateMatchImagePrompt(
  admin: AdminClient,
  summaryId: string,
): Promise<GenerateImagePromptResult> {
  // Gate on the key first so a dormant deploy never touches the DB or network.
  if (!env.openrouterApiKey) return { generated: false, reason: "no-key" };

  const { data: row } = await admin
    .from("match_summaries")
    .select("content, match_id")
    .eq("id", summaryId)
    .maybeSingle();
  if (!row) return { generated: false, reason: "missing" };

  const content = (row.content ?? "").trim();
  if (!content) return { generated: false, reason: "empty-content" };

  const { data: match } = await admin
    .from("matches")
    .select("home_team, away_team, home_score, away_score, stage, group_code")
    .eq("id", row.match_id)
    .maybeSingle();
  if (!match) return { generated: false, reason: "missing" };

  const messages = buildImagePromptMessages(content, match as SummaryMatch);

  const completion = await createChatCompletion({
    messages: [
      { role: "system", content: messages.system },
      { role: "user", content: messages.user },
    ],
    maxTokens: IMAGE_PROMPT_MAX_TOKENS,
    // A touch warmer than the recap: the comic panels are creative, but the
    // grounding constraints in the system prompt still dominate.
    temperature: 0.8,
  });
  // Key was unset between the gate and here, or provider returned no client.
  if (!completion) return { generated: false, reason: "no-key" };

  // Sanity-only: the template needs exactly four panels. If the model drifts, we
  // still store the prompt (an admin can regenerate) but log it for visibility.
  const panelCount = (completion.content.match(/^###\s+\*\*Panel\b/gim) ?? []).length;
  if (panelCount !== 4) {
    console.warn(
      `[match-image-prompt] expected 4 panels for ${summaryId}, model returned ${panelCount}`,
    );
  }

  const imagePrompt = assembleImagePrompt(completion.content);

  const { error } = await admin
    .from("match_summaries")
    .update({ image_prompt: imagePrompt })
    .eq("id", summaryId);
  if (error) {
    throw new Error(`Failed to store image prompt for ${summaryId}: ${error.message}`);
  }

  return { generated: true };
}
