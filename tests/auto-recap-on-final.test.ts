import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Unit tests for the two convergent batch passes that auto-drive the recap image
// pipeline off the sync cron: generatePendingImagePrompts (summary → prompt) and
// requestPendingRenders (prompt → render). Covers key gating, pure selection /
// idempotency (only the next-missing artifact is processed), and per-item error
// isolation (one failure increments errors without aborting the batch).
//
// The batch passes call their single-item siblings (generateMatchImagePrompt /
// requestMatchImageRender) by lexical binding within the same module, so a
// module-namespace spy cannot intercept them. Instead we mock the real boundary
// dependencies the single-item fns use — OpenRouter's createChatCompletion and
// global fetch (Leonardo) — and a Supabase admin double that serves both the
// batch selection queries AND the single-item lookups/writes. This exercises the
// real wiring end to end, as the existing match-summary / render tests do.

const envMock = vi.hoisted(
  () =>
    ({
      openrouterApiKey: "or-key",
      leonardoApiKey: "leo-key",
      leonardoModel: "gpt-image-2",
    }) as {
      openrouterApiKey: string | null;
      leonardoApiKey: string | null;
      leonardoModel: string;
    },
);

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/lib/ai/openrouter", () => ({ createChatCompletion: vi.fn() }));

import { createChatCompletion } from "@/lib/ai/openrouter";
import { generatePendingImagePrompts } from "@/lib/matches/match-image-prompt";
import { requestPendingRenders } from "@/lib/matches/match-image-render";

const chatMock = vi.mocked(createChatCompletion);

// ---------------------------------------------------------------------------
// generatePendingImagePrompts (summary → image_prompt)
// ---------------------------------------------------------------------------

type PromptSummary = { id: string; content: string | null; image_prompt: string | null };

type PromptAdminOpts = {
  finals?: { id: string }[];
  finalsError?: { message: string } | null;
  summaries?: PromptSummary[];
  summariesError?: { message: string } | null;
};

// A match the single-item generateMatchImagePrompt looks up after selecting a
// pending summary; constant since the prompt content doesn't matter here.
const MATCH_ROW = {
  home_team: "Mexico",
  away_team: "Canada",
  home_score: 2,
  away_score: 1,
  stage: "group",
  group_code: "A",
};

function makePromptAdmin(opts: PromptAdminOpts) {
  const summaries = opts.summaries ?? [];
  const updatedIds: string[] = [];
  const from = vi.fn((table: string) => {
    if (table === "matches") {
      return {
        select: () => ({
          // batch: .eq("status","final").order().limit()
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: opts.finalsError ? null : (opts.finals ?? []),
                error: opts.finalsError ?? null,
              }),
            }),
            // single-item: generateMatchImagePrompt's match lookup
            // .eq("id", matchId).maybeSingle()
            maybeSingle: async () => ({ data: MATCH_ROW, error: null }),
          }),
        }),
      };
    }
    if (table === "match_summaries") {
      return {
        select: () => ({
          // batch selection: .eq("is_active",true).in("match_id",[...])
          eq: (col: string, _val: unknown) => ({
            in: async () => ({
              data: opts.summariesError ? null : summaries,
              error: opts.summariesError ?? null,
            }),
            // single-item content lookup: .eq("id", summaryId).maybeSingle()
            maybeSingle: async () => {
              const row = summaries.find((s) => s.id === _val);
              return {
                data: row ? { content: row.content, match_id: "m1" } : null,
                error: null,
              };
            },
          }),
        }),
        update: () => ({
          eq: async (_col: string, id: string) => {
            updatedIds.push(id);
            return { error: null };
          },
        }),
      };
    }
    throw new Error(`unexpected from(${table})`);
  });
  return { from, updatedIds };
}

beforeEach(() => {
  chatMock.mockReset();
  // Default: a valid four-panel completion so the single-item prompt fn succeeds.
  chatMock.mockResolvedValue({
    content:
      "### **Panel 1**\n* **Visual:** a\n### **Panel 2**\n* **Visual:** b\n" +
      "### **Panel 3**\n* **Visual:** c\n### **Panel 4**\n* **Visual:** d",
    model: "test/model",
    promptTokens: 1,
    completionTokens: 2,
  });
});

describe("generatePendingImagePrompts", () => {
  beforeEach(() => {
    envMock.openrouterApiKey = "or-key";
  });

  it("no-ops without DB access when the OpenRouter key is unset", async () => {
    envMock.openrouterApiKey = null;
    const admin = makePromptAdmin({});
    const result = await generatePendingImagePrompts(admin as never);
    expect(result).toEqual({ candidates: 0, generated: 0, skipped: 0, errors: 0 });
    expect(admin.from).not.toHaveBeenCalled();
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("returns zeros (no work) when there are no final matches", async () => {
    const admin = makePromptAdmin({ finals: [] });
    const result = await generatePendingImagePrompts(admin as never);
    expect(result).toEqual({ candidates: 0, generated: 0, skipped: 0, errors: 0 });
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("only generates for active summaries that have content but no image_prompt", async () => {
    const admin = makePromptAdmin({
      finals: [{ id: "m1" }, { id: "m2" }, { id: "m3" }, { id: "m4" }],
      summaries: [
        { id: "s1", content: "Recap one.", image_prompt: null }, // pending
        { id: "s2", content: "Recap two.", image_prompt: "" }, // pending (empty)
        { id: "s3", content: "Recap three.", image_prompt: "ALREADY" }, // skip (has prompt)
        { id: "s4", content: "   ", image_prompt: null }, // skip (no content)
      ],
    });
    const result = await generatePendingImagePrompts(admin as never);
    expect(result).toEqual({ candidates: 2, generated: 2, skipped: 0, errors: 0 });
    // One OpenRouter call per pending summary; s3/s4 never reach generation.
    expect(chatMock).toHaveBeenCalledTimes(2);
    expect(admin.updatedIds.sort()).toEqual(["s1", "s2"]);
  });

  it("isolates a single-item failure: increments errors and continues the batch", async () => {
    // First generation throws (OpenRouter), the second succeeds.
    chatMock.mockReset();
    chatMock
      .mockRejectedValueOnce(new Error("openrouter boom"))
      .mockResolvedValueOnce({
        content:
          "### **Panel 1**\n* a\n### **Panel 2**\n* b\n### **Panel 3**\n* c\n### **Panel 4**\n* d",
        model: "test/model",
        promptTokens: 1,
        completionTokens: 2,
      });
    const admin = makePromptAdmin({
      finals: [{ id: "m1" }, { id: "m2" }],
      summaries: [
        { id: "s1", content: "Recap one.", image_prompt: null },
        { id: "s2", content: "Recap two.", image_prompt: null },
      ],
    });
    const result = await generatePendingImagePrompts(admin as never);
    expect(result).toEqual({ candidates: 2, generated: 1, skipped: 0, errors: 1 });
    expect(chatMock).toHaveBeenCalledTimes(2);
  });

  it("records an error and stops when loading final matches fails", async () => {
    const admin = makePromptAdmin({ finalsError: { message: "db down" } });
    const result = await generatePendingImagePrompts(admin as never);
    expect(result).toEqual({ candidates: 0, generated: 0, skipped: 0, errors: 1 });
    expect(chatMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requestPendingRenders (image_prompt → render)
// ---------------------------------------------------------------------------

type RenderSummary = { id: string; image_prompt: string | null };

type RenderAdminOpts = {
  finals?: { id: string }[];
  finalsError?: { message: string } | null;
  summaries?: RenderSummary[];
  summariesError?: { message: string } | null;
  existingRenders?: { summary_id: string }[];
  existingError?: { message: string } | null;
};

function makeRenderAdmin(opts: RenderAdminOpts) {
  const summaries = opts.summaries ?? [];
  const upsertedSummaryIds: string[] = [];
  const upsert = vi.fn((payload: Record<string, unknown>) => {
    upsertedSummaryIds.push(payload.summary_id as string);
    return Promise.resolve({ error: null });
  });
  const from = vi.fn((table: string) => {
    if (table === "matches") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: opts.finalsError ? null : (opts.finals ?? []),
                error: opts.finalsError ?? null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === "match_summaries") {
      return {
        select: () => ({
          eq: (_col: string, val: unknown) => ({
            // batch selection: .eq("is_active",true).in("match_id",[...])
            in: async () => ({
              data: opts.summariesError ? null : summaries,
              error: opts.summariesError ?? null,
            }),
            // single-item: requestMatchImageRender's lookup
            // .eq("id", summaryId).maybeSingle()
            maybeSingle: async () => {
              const row = summaries.find((s) => s.id === val);
              return {
                data: row ? { image_prompt: row.image_prompt, match_id: "m1" } : null,
                error: null,
              };
            },
          }),
        }),
      };
    }
    if (table === "match_summary_images") {
      return {
        // batch anti-join: .select("summary_id").in("summary_id",[...])
        select: () => ({
          in: async () => ({
            data: opts.existingError ? null : (opts.existingRenders ?? []),
            error: opts.existingError ?? null,
          }),
        }),
        upsert,
      };
    }
    throw new Error(`unexpected from(${table})`);
  });
  return { from, upsertedSummaryIds };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  // Default: a successful Leonardo create-generation reply.
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ sdGenerationJob: { generationId: "gen-1" } }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestPendingRenders", () => {
  beforeEach(() => {
    envMock.leonardoApiKey = "leo-key";
  });

  it("no-ops without DB access when the Leonardo key is unset", async () => {
    envMock.leonardoApiKey = null;
    const admin = makeRenderAdmin({});
    const result = await requestPendingRenders(admin as never);
    expect(result).toEqual({ candidates: 0, requested: 0, skipped: 0, errors: 0 });
    expect(admin.from).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns zeros when no active summary has a prompt", async () => {
    const admin = makeRenderAdmin({
      finals: [{ id: "m1" }],
      summaries: [{ id: "s1", image_prompt: null }],
    });
    const result = await requestPendingRenders(admin as never);
    expect(result).toEqual({ candidates: 0, requested: 0, skipped: 0, errors: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only requests renders for prompted summaries with no existing render row", async () => {
    const admin = makeRenderAdmin({
      finals: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
      summaries: [
        { id: "s1", image_prompt: "PROMPT 1" }, // pending → request
        { id: "s2", image_prompt: "PROMPT 2" }, // already has a render row → skip
        { id: "s3", image_prompt: "  " }, // no prompt → not even a candidate
      ],
      existingRenders: [{ summary_id: "s2" }],
    });
    const result = await requestPendingRenders(admin as never);
    expect(result).toEqual({ candidates: 1, requested: 1, skipped: 0, errors: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(admin.upsertedSummaryIds).toEqual(["s1"]);
  });

  it("does not re-request when a render row exists in ANY status (idempotent / no dupes)", async () => {
    const admin = makeRenderAdmin({
      finals: [{ id: "m1" }, { id: "m2" }],
      summaries: [
        { id: "s1", image_prompt: "P1" },
        { id: "s2", image_prompt: "P2" },
      ],
      // s1 has a failed row, s2 a pending row — neither should be re-requested.
      existingRenders: [{ summary_id: "s1" }, { summary_id: "s2" }],
    });
    const result = await requestPendingRenders(admin as never);
    expect(result).toEqual({ candidates: 0, requested: 0, skipped: 0, errors: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("isolates a single-item failure: increments errors and continues the batch", async () => {
    // First Leonardo call fails (records a failed row + rethrows), second succeeds.
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sdGenerationJob: { generationId: "gen-2" } }),
      });
    const admin = makeRenderAdmin({
      finals: [{ id: "m1" }, { id: "m2" }],
      summaries: [
        { id: "s1", image_prompt: "P1" },
        { id: "s2", image_prompt: "P2" },
      ],
      existingRenders: [],
    });
    const result = await requestPendingRenders(admin as never);
    expect(result).toEqual({ candidates: 2, requested: 1, skipped: 0, errors: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("records an error and stops when loading final matches fails", async () => {
    const admin = makeRenderAdmin({ finalsError: { message: "db down" } });
    const result = await requestPendingRenders(admin as never);
    expect(result).toEqual({ candidates: 0, requested: 0, skipped: 0, errors: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
