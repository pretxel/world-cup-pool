import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Unit tests for the Leonardo render core: request (key gating, no-prompt skip,
// POST shape, pending row), shared finalize (download → upload → complete, with
// idempotency + unknown-id), and the poll fallback.

const envMock = vi.hoisted(
  () =>
    ({
      leonardoApiKey: "leo-key",
      leonardoModel: "gpt-image-2",
      leonardoWebhookSecret: "whsec",
    }) as {
      leonardoApiKey: string | null;
      leonardoModel: string;
      leonardoWebhookSecret: string | null;
    },
);

vi.mock("@/lib/env", () => ({ env: envMock }));

import {
  requestMatchImageRender,
  finalizeRender,
  pollMatchImageRender,
} from "@/lib/matches/match-image-render";

type AdminOpts = {
  summary?: { image_prompt: string | null; match_id: string } | null;
  renderRow?: { id: string; match_id: string; summary_id: string; status: string } | null;
  pollRow?: { generation_id: string | null; status: string } | null;
  upsertError?: { message: string } | null;
  updateError?: { message: string } | null;
  uploadError?: { message: string } | null;
};

function makeAdmin(opts: AdminOpts) {
  const upsertPayloads: Record<string, unknown>[] = [];
  const updatePayloads: Record<string, unknown>[] = [];
  const uploads: { path: string; options: unknown }[] = [];
  const storageUpload = vi.fn(async (path: string, _body: unknown, options: unknown) => {
    uploads.push({ path, options });
    return { data: opts.uploadError ? null : { path }, error: opts.uploadError ?? null };
  });
  const from = vi.fn((table: string) => {
    if (table === "match_summaries") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: opts.summary ?? null, error: null }),
          }),
        }),
      };
    }
    if (table === "match_summary_images") {
      return {
        // finalize looks up by generation_id; poll looks up by summary_id.
        select: () => ({
          eq: (col: string) => ({
            maybeSingle: async () => ({
              data: col === "generation_id" ? (opts.renderRow ?? null) : (opts.pollRow ?? null),
              error: null,
            }),
          }),
        }),
        upsert: (payload: Record<string, unknown>) => {
          upsertPayloads.push(payload);
          return Promise.resolve({ error: opts.upsertError ?? null });
        },
        update: (payload: Record<string, unknown>) => {
          updatePayloads.push(payload);
          return { eq: async () => ({ error: opts.updateError ?? null }) };
        },
      };
    }
    throw new Error(`unexpected from(${table})`);
  });
  const storage = { from: vi.fn(() => ({ upload: storageUpload })) };
  return { from, storage, upsertPayloads, updatePayloads, uploads, storageUpload };
}

const fetchMock = vi.fn();

function imageResponse(contentType = "image/png") {
  return {
    ok: true,
    headers: { get: () => contentType },
    arrayBuffer: async () => new ArrayBuffer(8),
  };
}

beforeEach(() => {
  envMock.leonardoApiKey = "leo-key";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestMatchImageRender", () => {
  it("is dormant when the Leonardo key is unset (no fetch, no write)", async () => {
    envMock.leonardoApiKey = null;
    const admin = makeAdmin({});
    const result = await requestMatchImageRender(admin as never, "s1");
    expect(result).toEqual({ requested: false, reason: "no-key" });
    expect(admin.from).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns missing when the recap row is absent", async () => {
    const admin = makeAdmin({ summary: null });
    const result = await requestMatchImageRender(admin as never, "s1");
    expect(result).toEqual({ requested: false, reason: "missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips with no-prompt when the version has no image_prompt", async () => {
    const admin = makeAdmin({ summary: { image_prompt: null, match_id: "m1" } });
    const result = await requestMatchImageRender(admin as never, "s1");
    expect(result).toEqual({ requested: false, reason: "no-prompt" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs gpt-image-2 with 2:3 dims and records a pending row", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sdGenerationJob: { generationId: "gen-1" } }),
    });
    const admin = makeAdmin({ summary: { image_prompt: "COMIC PROMPT", match_id: "m1" } });
    const result = await requestMatchImageRender(admin as never, "s1");
    expect(result).toEqual({ requested: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://cloud.leonardo.ai/api/rest/v2/generations");
    const body = JSON.parse((init as { body: string }).body);
    // v2 nests generation settings under `parameters`; `model` stays top-level.
    expect(body).toMatchObject({
      model: "gpt-image-2",
      parameters: {
        prompt: "COMIC PROMPT",
        quality: "MEDIUM",
        quantity: 1,
        width: 832,
        height: 1248,
      },
    });
    expect(body.quality).toBeUndefined();

    expect(admin.upsertPayloads).toHaveLength(1);
    expect(admin.upsertPayloads[0]).toMatchObject({
      summary_id: "s1",
      match_id: "m1",
      generation_id: "gen-1",
      status: "pending",
    });
  });

  it("records a failed row and throws on a Leonardo error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    const admin = makeAdmin({ summary: { image_prompt: "PROMPT", match_id: "m1" } });
    await expect(requestMatchImageRender(admin as never, "s1")).rejects.toThrow(/Leonardo 500/);
    expect(admin.upsertPayloads[0]).toMatchObject({ status: "failed", generation_id: null });
  });
});

describe("finalizeRender", () => {
  it("returns unknown when no render row matches the generation id", async () => {
    const admin = makeAdmin({ renderRow: null });
    const result = await finalizeRender(admin as never, "gen-x", "http://img/x.png");
    expect(result).toEqual({ finalized: false, reason: "unknown" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is idempotent — no-op when the render is already complete", async () => {
    const admin = makeAdmin({
      renderRow: { id: "r1", match_id: "m1", summary_id: "s1", status: "complete" },
    });
    const result = await finalizeRender(admin as never, "gen-1", "http://img/x.png");
    expect(result).toEqual({ finalized: false, reason: "already-complete" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(admin.storageUpload).not.toHaveBeenCalled();
  });

  it("downloads, uploads to the deterministic path, and marks complete", async () => {
    fetchMock.mockResolvedValue(imageResponse("image/png"));
    const admin = makeAdmin({
      renderRow: { id: "r1", match_id: "m1", summary_id: "s1", status: "pending" },
    });
    const result = await finalizeRender(admin as never, "gen-1", "http://img/x.png");
    expect(result).toEqual({ finalized: true, storagePath: "m1/s1.png" });
    expect(admin.uploads[0].path).toBe("m1/s1.png");
    expect(admin.updatePayloads[0]).toMatchObject({ status: "complete", storage_path: "m1/s1.png" });
  });

  it("throws when the image download fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const admin = makeAdmin({
      renderRow: { id: "r1", match_id: "m1", summary_id: "s1", status: "pending" },
    });
    await expect(finalizeRender(admin as never, "gen-1", "http://img/x.png")).rejects.toThrow(
      /Failed to download render/,
    );
  });
});

describe("pollMatchImageRender", () => {
  it("is dormant when the Leonardo key is unset", async () => {
    envMock.leonardoApiKey = null;
    const admin = makeAdmin({});
    expect(await pollMatchImageRender(admin as never, "s1")).toEqual({
      polled: false,
      reason: "no-key",
    });
  });

  it("returns missing when there is no pending generation to poll", async () => {
    const admin = makeAdmin({ pollRow: { generation_id: null, status: "pending" } });
    expect(await pollMatchImageRender(admin as never, "s1")).toEqual({
      polled: false,
      reason: "missing",
    });
  });

  it("returns pending when Leonardo has not finished", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ generations_by_pk: { status: "PENDING", generated_images: [] } }),
    });
    const admin = makeAdmin({ pollRow: { generation_id: "gen-1", status: "pending" } });
    expect(await pollMatchImageRender(admin as never, "s1")).toEqual({
      polled: false,
      reason: "pending",
    });
  });

  it("finalizes a completed generation via the shared finalize path", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          generations_by_pk: { status: "COMPLETE", generated_images: [{ url: "http://img/x.png" }] },
        }),
      })
      .mockResolvedValueOnce(imageResponse("image/png"));
    const admin = makeAdmin({
      pollRow: { generation_id: "gen-1", status: "pending" },
      renderRow: { id: "r1", match_id: "m1", summary_id: "s1", status: "pending" },
    });
    const result = await pollMatchImageRender(admin as never, "s1");
    expect(result).toEqual({ polled: true });
    expect(admin.uploads[0].path).toBe("m1/s1.png");
    expect(admin.updatePayloads[0]).toMatchObject({ status: "complete" });
  });
});
