import "server-only";
import { env } from "@/lib/env";

// Minimal OpenRouter chat-completions client over `fetch` (OpenRouter is
// OpenAI-compatible, so no SDK dependency). Server-only: it reads the secret
// API key and must never be imported into client code.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatCompletionResult = {
  content: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
};

export type ChatCompletionOptions = {
  messages: ChatMessage[];
  // Defaults to env.openrouterModel.
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

type OpenRouterResponse = {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/**
 * Request a chat completion from OpenRouter.
 *
 * Returns `null` (never throws) when `OPENROUTER_API_KEY` is unset, so callers
 * treat a missing key as "feature dormant — skip" rather than an error. A
 * configured key that then fails the HTTP call or returns empty content DOES
 * throw, so the caller can record/log a real failure.
 */
export async function createChatCompletion(
  opts: ChatCompletionOptions,
): Promise<ChatCompletionResult | null> {
  const apiKey = env.openrouterApiKey;
  if (!apiKey) return null;

  const model = opts.model ?? env.openrouterModel;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Attribution headers OpenRouter uses for app-level analytics/ranking.
      "HTTP-Referer": env.siteUrl,
      "X-Title": "World Cup Pools",
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 320,
      temperature: opts.temperature ?? 0.5,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as OpenRouterResponse;
  const content = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) {
    throw new Error("OpenRouter returned an empty completion");
  }

  return {
    content,
    model: json.model ?? model,
    promptTokens: json.usage?.prompt_tokens ?? null,
    completionTokens: json.usage?.completion_tokens ?? null,
  };
}
