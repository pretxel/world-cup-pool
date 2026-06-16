import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit tests for the AI match-summary generator: idempotency, status gating,
// key short-circuit, prompt shape, and persistence on success.

const envMock = vi.hoisted(
  () =>
    ({
      openrouterApiKey: "test-key",
      openrouterModel: "test/model",
      siteUrl: "http://localhost:3000",
    }) as {
      openrouterApiKey: string | null;
      openrouterModel: string;
      siteUrl: string;
    },
);

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/lib/ai/openrouter", () => ({ createChatCompletion: vi.fn() }));

import { createChatCompletion } from "@/lib/ai/openrouter";
import {
  buildSummaryPrompt,
  generateMatchSummary,
  generatePendingSummaries,
  type SummaryMatch,
} from "@/lib/matches/match-summary";

const chatMock = vi.mocked(createChatCompletion);

const FINAL_MATCH: SummaryMatch & { status: string } = {
  home_team: "Mexico",
  away_team: "Canada",
  home_score: 2,
  away_score: 1,
  status: "final",
  stage: "group",
  group_code: "A",
};

type AdminOpts = {
  existing?: { id: string } | null;
  match?: Record<string, unknown> | null;
  events?: unknown[];
  insertError?: { code?: string; message?: string } | null;
};

function makeAdmin(opts: AdminOpts) {
  const insert = vi.fn(async () => ({ error: opts.insertError ?? null }));
  const from = vi.fn((table: string) => {
    if (table === "match_summaries") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: opts.existing ?? null, error: null }),
          }),
        }),
        insert,
      };
    }
    if (table === "matches") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: opts.match ?? null, error: null }),
          }),
        }),
      };
    }
    if (table === "match_events") {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: opts.events ?? [], error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected from(${table})`);
  });
  return { from, insert };
}

beforeEach(() => {
  envMock.openrouterApiKey = "test-key";
  chatMock.mockReset();
});

describe("generateMatchSummary", () => {
  it("short-circuits without DB or network when the key is unset", async () => {
    envMock.openrouterApiKey = null;
    const admin = makeAdmin({});
    const result = await generateMatchSummary(admin as never, "m1");
    expect(result).toEqual({ generated: false, reason: "no-key" });
    expect(admin.from).not.toHaveBeenCalled();
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("skips when a summary already exists", async () => {
    const admin = makeAdmin({ existing: { id: "s1" } });
    const result = await generateMatchSummary(admin as never, "m1");
    expect(result).toEqual({ generated: false, reason: "exists" });
    expect(chatMock).not.toHaveBeenCalled();
    expect(admin.insert).not.toHaveBeenCalled();
  });

  it("skips a non-final match", async () => {
    const admin = makeAdmin({
      existing: null,
      match: { ...FINAL_MATCH, status: "live" },
    });
    const result = await generateMatchSummary(admin as never, "m1");
    expect(result).toEqual({ generated: false, reason: "not-final" });
    expect(chatMock).not.toHaveBeenCalled();
    expect(admin.insert).not.toHaveBeenCalled();
  });

  it("skips when the match is missing", async () => {
    const admin = makeAdmin({ existing: null, match: null });
    const result = await generateMatchSummary(admin as never, "m1");
    expect(result).toEqual({ generated: false, reason: "missing" });
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("generates and persists a recap on success", async () => {
    chatMock.mockResolvedValue({
      content: "Mexico edged Canada 2-1.",
      model: "test/model",
      promptTokens: 11,
      completionTokens: 22,
    });
    const admin = makeAdmin({
      existing: null,
      match: FINAL_MATCH,
      events: [
        { type: "goal", team: "home", minute: 12, extra_minute: null, player: "Lozano", detail: null },
      ],
    });
    const result = await generateMatchSummary(admin as never, "m1");
    expect(result).toEqual({ generated: true });
    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(admin.insert).toHaveBeenCalledTimes(1);
    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        match_id: "m1",
        content: "Mexico edged Canada 2-1.",
        provider: "openrouter",
        model: "test/model",
        prompt_tokens: 11,
        completion_tokens: 22,
        locale: "en",
      }),
    );
  });

  it("treats a unique-violation on insert as already-exists (concurrent race)", async () => {
    chatMock.mockResolvedValue({
      content: "Recap.",
      model: "test/model",
      promptTokens: null,
      completionTokens: null,
    });
    const admin = makeAdmin({
      existing: null,
      match: FINAL_MATCH,
      events: [],
      insertError: { code: "23505", message: "duplicate key" },
    });
    const result = await generateMatchSummary(admin as never, "m1");
    expect(result).toEqual({ generated: false, reason: "exists" });
  });
});

describe("buildSummaryPrompt", () => {
  it("instructs English output and includes the score and events", () => {
    const prompt = buildSummaryPrompt(FINAL_MATCH, [
      { type: "goal", team: "home", minute: 12, extra_minute: null, player: "Lozano", detail: null },
    ]);
    expect(prompt.system).toContain("English");
    expect(prompt.user).toContain("Mexico 2 - 1 Canada");
    expect(prompt.user).toContain("Lozano");
    expect(prompt.user).toContain("Goal");
  });

  it("notes when no events were recorded", () => {
    const prompt = buildSummaryPrompt(FINAL_MATCH, []);
    expect(prompt.user).toContain("no individual events");
  });
});

describe("generatePendingSummaries", () => {
  it("no-ops without DB access when the key is unset", async () => {
    envMock.openrouterApiKey = null;
    const admin = makeAdmin({});
    const result = await generatePendingSummaries(admin as never);
    expect(result).toEqual({ candidates: 0, generated: 0, skipped: 0, errors: 0 });
    expect(admin.from).not.toHaveBeenCalled();
  });
});
