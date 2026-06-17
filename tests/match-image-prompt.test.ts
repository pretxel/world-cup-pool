import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit tests for the comic-strip image-prompt generator: pure message shape,
// verbatim-template assembly, key short-circuit, row/content gating, persistence
// to `image_prompt`, and provider/DB failure propagation.

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
  IMAGE_PROMPT_TEMPLATE_HEADER,
  assembleImagePrompt,
  buildImagePromptMessages,
  generateMatchImagePrompt,
} from "@/lib/matches/match-image-prompt";
import type { SummaryMatch } from "@/lib/matches/match-summary";

const chatMock = vi.mocked(createChatCompletion);

const MATCH: SummaryMatch = {
  home_team: "Mexico",
  away_team: "Canada",
  home_score: 2,
  away_score: 1,
  stage: "group",
  group_code: "A",
};

const PANELS = [
  "### **Panel 1**",
  '* **Visual:** Kenji watches kickoff on TV.',
  '* **Narration Box:** "Mexico vs Canada begins!"',
  "### **Panel 2**",
  '* **Visual:** Lozano strikes.',
  '* **Narration Box:** "12th minute — Mexico lead!"',
  "### **Panel 3**",
  '* **Visual:** Canada pull one back.',
  '* **Narration Box:** "Canada respond."',
  "### **Panel 4**",
  '* **Visual:** Kenji cheers the final whistle.',
  '* **Narration Box:** "Mexico hold on, 2-1."',
].join("\n");

type AdminOpts = {
  summary?: { content: string; match_id: string } | null;
  match?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
};

function makeAdmin(opts: AdminOpts) {
  const updatePayloads: Record<string, unknown>[] = [];
  const from = vi.fn((table: string) => {
    if (table === "match_summaries") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: opts.summary ?? null, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          updatePayloads.push(payload);
          return { eq: async () => ({ error: opts.updateError ?? null }) };
        },
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
    throw new Error(`unexpected from(${table})`);
  });
  return { from, updatePayloads };
}

beforeEach(() => {
  envMock.openrouterApiKey = "test-key";
  chatMock.mockReset();
});

describe("buildImagePromptMessages", () => {
  it("asks for ONLY four panels, grounded in the recap and match facts", () => {
    const { system, user } = buildImagePromptMessages("Mexico edged Canada 2-1.", MATCH);
    expect(system).toContain("four panels");
    expect(system).toContain("ONLY");
    expect(system.toLowerCase()).toContain("never invent");
    expect(system).toContain("Kenji");
    // The match context + the recap text are both handed to the model.
    expect(user).toContain("Mexico 2 - 1 Canada");
    expect(user).toContain("Mexico edged Canada 2-1.");
  });

  it("does not ask the model to emit the fixed sections", () => {
    const { system } = buildImagePromptMessages("Recap.", MATCH);
    // The model writes only the panels; the fixed sections are assembled in code.
    expect(system).toContain("only the four panels");
  });
});

describe("assembleImagePrompt", () => {
  it("prefixes the verbatim template header and appends the panels", () => {
    const out = assembleImagePrompt(PANELS);
    expect(out.startsWith(IMAGE_PROMPT_TEMPLATE_HEADER)).toBe(true);
    expect(out).toContain("### **ART STYLE:**");
    expect(out).toContain("### **CHARACTER DESIGN:**");
    expect(out).toContain("### **TECHNICAL SPECIFICATIONS:**");
    expect(out).toContain("### **PANEL LAYOUT & SCENE SEQUENCE:**");
    expect(out).toContain("### **Panel 4**");
    expect(out.endsWith("\n")).toBe(true);
  });
});

describe("generateMatchImagePrompt", () => {
  it("short-circuits without DB or network when the key is unset", async () => {
    envMock.openrouterApiKey = null;
    const admin = makeAdmin({});
    const result = await generateMatchImagePrompt(admin as never, "s1");
    expect(result).toEqual({ generated: false, reason: "no-key" });
    expect(admin.from).not.toHaveBeenCalled();
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("returns missing when the recap row is absent", async () => {
    const admin = makeAdmin({ summary: null });
    const result = await generateMatchImagePrompt(admin as never, "s1");
    expect(result).toEqual({ generated: false, reason: "missing" });
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("returns empty-content when the recap text is blank (no network)", async () => {
    const admin = makeAdmin({ summary: { content: "   ", match_id: "m1" } });
    const result = await generateMatchImagePrompt(admin as never, "s1");
    expect(result).toEqual({ generated: false, reason: "empty-content" });
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("returns missing when the parent match is absent", async () => {
    const admin = makeAdmin({
      summary: { content: "Mexico edged Canada 2-1.", match_id: "m1" },
      match: null,
    });
    const result = await generateMatchImagePrompt(admin as never, "s1");
    expect(result).toEqual({ generated: false, reason: "missing" });
  });

  it("assembles the full prompt and writes it to image_prompt on success", async () => {
    chatMock.mockResolvedValue({
      content: PANELS,
      model: "test/model",
      promptTokens: 30,
      completionTokens: 120,
    });
    const admin = makeAdmin({
      summary: { content: "Mexico edged Canada 2-1.", match_id: "m1" },
      match: MATCH,
    });
    const result = await generateMatchImagePrompt(admin as never, "s1");
    expect(result).toEqual({ generated: true });
    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(admin.updatePayloads).toHaveLength(1);
    const stored = admin.updatePayloads[0].image_prompt as string;
    expect(stored).toContain("### **ART STYLE:**");
    expect(stored).toContain("### **PANEL LAYOUT & SCENE SEQUENCE:**");
    // Exactly four panels — all of 1-4 present, none beyond.
    expect(stored).toContain("### **Panel 1**");
    expect(stored).toContain("### **Panel 2**");
    expect(stored).toContain("### **Panel 3**");
    expect(stored).toContain("### **Panel 4**");
    expect(stored).not.toContain("### **Panel 5**");
    expect((stored.match(/### \*\*Panel/g) ?? []).length).toBe(4);
    // Grounded in the supplied teams (panels reference the actual match).
    expect(stored).toContain("Mexico");
    expect(stored).toContain("Canada");
  });

  it("treats a null completion (key dropped) as no-key, no write", async () => {
    chatMock.mockResolvedValue(null);
    const admin = makeAdmin({
      summary: { content: "Recap.", match_id: "m1" },
      match: MATCH,
    });
    const result = await generateMatchImagePrompt(admin as never, "s1");
    expect(result).toEqual({ generated: false, reason: "no-key" });
    expect(admin.updatePayloads).toHaveLength(0);
  });

  it("propagates a provider failure (configured key)", async () => {
    chatMock.mockRejectedValue(new Error("OpenRouter 500"));
    const admin = makeAdmin({
      summary: { content: "Recap.", match_id: "m1" },
      match: MATCH,
    });
    await expect(generateMatchImagePrompt(admin as never, "s1")).rejects.toThrow(
      "OpenRouter 500",
    );
  });

  it("throws on a DB write error", async () => {
    chatMock.mockResolvedValue({
      content: PANELS,
      model: "test/model",
      promptTokens: null,
      completionTokens: null,
    });
    const admin = makeAdmin({
      summary: { content: "Recap.", match_id: "m1" },
      match: MATCH,
      updateError: { message: "boom" },
    });
    await expect(generateMatchImagePrompt(admin as never, "s1")).rejects.toThrow(
      /Failed to store image prompt/,
    );
  });
});
