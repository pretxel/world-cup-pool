import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests for the Leonardo /api/callback-image webhook: bearer auth (incl. unset
// secret), event filtering, unknown/idempotent handling, and finalize wiring.

const envMock = vi.hoisted(
  () => ({ leonardoWebhookSecret: "whsec" }) as { leonardoWebhookSecret: string | null },
);
vi.mock("@/lib/env", () => ({ env: envMock }));

const finalizeMock = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{ finalized: boolean; reason?: string; storagePath?: string }> => ({
      finalized: true,
      storagePath: "m1/s1.png",
    }),
  ),
);
vi.mock("@/lib/matches/match-image-render", () => ({ finalizeRender: finalizeMock }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({ tag: "admin" }),
}));

import { POST } from "@/app/api/callback-image/route";

function post(body: unknown, auth?: string): Request {
  return new Request("https://world-pool.edselserrano.com/api/callback-image", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

const COMPLETE = {
  type: "image_generation.complete",
  object: "generation",
  data: { object: { id: "gen-1", images: [{ url: "http://img/x.png" }] } },
};

beforeEach(() => {
  envMock.leonardoWebhookSecret = "whsec";
  finalizeMock.mockReset().mockResolvedValue({ finalized: true, storagePath: "m1/s1.png" });
});

describe("POST /api/callback-image", () => {
  it("rejects with 401 when the webhook secret is unset", async () => {
    envMock.leonardoWebhookSecret = null;
    const res = await POST(post(COMPLETE, "Bearer whsec"));
    expect(res.status).toBe(401);
    expect(finalizeMock).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the bearer token is missing", async () => {
    const res = await POST(post(COMPLETE));
    expect(res.status).toBe(401);
    expect(finalizeMock).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the bearer token is wrong", async () => {
    const res = await POST(post(COMPLETE, "Bearer nope"));
    expect(res.status).toBe(401);
    expect(finalizeMock).not.toHaveBeenCalled();
  });

  it("finalizes a valid completion and returns 200", async () => {
    const res = await POST(post(COMPLETE, "Bearer whsec"));
    expect(res.status).toBe(200);
    expect(finalizeMock).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "admin" }),
      "gen-1",
      "http://img/x.png",
    );
  });

  it("acks (200) and ignores a non-completion event", async () => {
    const res = await POST(post({ type: "image_generation.started", data: {} }, "Bearer whsec"));
    expect(res.status).toBe(200);
    expect(finalizeMock).not.toHaveBeenCalled();
  });

  it("acks (200) and ignores a completion with no image url", async () => {
    const res = await POST(
      post({ type: "image_generation.complete", data: { object: { id: "gen-1", images: [] } } }, "Bearer whsec"),
    );
    expect(res.status).toBe(200);
    expect(finalizeMock).not.toHaveBeenCalled();
  });

  it("returns 200 for an idempotent already-complete finalize", async () => {
    finalizeMock.mockResolvedValue({ finalized: false, reason: "already-complete" });
    const res = await POST(post(COMPLETE, "Bearer whsec"));
    expect(res.status).toBe(200);
    expect(finalizeMock).toHaveBeenCalledTimes(1);
  });

  it("returns 200 for an unknown generation id (no matching render row)", async () => {
    finalizeMock.mockResolvedValue({ finalized: false, reason: "unknown" });
    const res = await POST(post(COMPLETE, "Bearer whsec"));
    expect(res.status).toBe(200);
  });

  it("returns 500 when finalize throws (so Leonardo retries)", async () => {
    finalizeMock.mockRejectedValue(new Error("upload failed"));
    const res = await POST(post(COMPLETE, "Bearer whsec"));
    expect(res.status).toBe(500);
  });
});
