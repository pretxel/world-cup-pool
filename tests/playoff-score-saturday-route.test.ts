import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Hoisted so the mock factories (lifted above imports) can reference them while
// the statically-imported route module loads.
const h = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  recordRunMock: vi.fn(),
  cronSecret: "cron-secret" as string | null,
  saturday: true,
}));

vi.mock("@/lib/env", () => ({
  env: {
    get cronSecret() {
      return h.cronSecret;
    },
  },
}));

vi.mock("@/lib/notifications/playoff-score-emails", () => ({
  dispatchPlayoffScoreEmail: h.dispatchMock,
  isSaturdayUtc: () => h.saturday,
}));

vi.mock("@/lib/competition", () => ({
  getActiveBranding: vi.fn(async () => ({ emailFromName: "WC Pool" })),
}));

vi.mock("@/lib/operations/record-run", () => ({
  recordRun: h.recordRunMock,
}));

import { GET } from "@/app/api/cron/playoff-score-saturday/route";

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/cron/playoff-score-saturday", {
    headers,
  }) as unknown as NextRequest;
}

beforeEach(() => {
  h.dispatchMock.mockReset().mockResolvedValue({ emailed: 3, failed: 0, skipped: 1 });
  h.recordRunMock
    .mockReset()
    .mockImplementation(async (_kind: string, _trigger: string, fn: () => Promise<unknown>) => ({
      summary: await fn(),
    }));
  h.cronSecret = "cron-secret";
  h.saturday = true;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/cron/playoff-score-saturday", () => {
  it("returns 401 when the bearer token is missing or wrong while a secret is set", async () => {
    const r1 = await GET(req());
    expect(r1.status).toBe(401);
    const r2 = await GET(req({ authorization: "Bearer nope" }));
    expect(r2.status).toBe(401);
    expect(h.dispatchMock).not.toHaveBeenCalled();
  });

  it("skips (204) on a non-Saturday run", async () => {
    h.saturday = false;
    const res = await GET(req({ authorization: "Bearer cron-secret" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("x-skipped")).toBe("not-saturday");
    expect(h.dispatchMock).not.toHaveBeenCalled();
  });

  it("records one playoff_score_email run and returns the dispatch summary", async () => {
    const res = await GET(req({ authorization: "Bearer cron-secret" }));
    expect(res.status).toBe(200);
    expect(h.recordRunMock).toHaveBeenCalledWith(
      "playoff_score_email",
      "cron",
      expect.any(Function),
    );
    expect(h.dispatchMock).toHaveBeenCalledWith("WC Pool");
    await expect(res.json()).resolves.toEqual({ emailed: 3, failed: 0, skipped: 1 });
  });

  it("catches a dispatch failure and returns a zero summary (no 500)", async () => {
    h.recordRunMock.mockRejectedValue(new Error("boom"));
    const res = await GET(req({ authorization: "Bearer cron-secret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ emailed: 0, failed: 0, skipped: 0 });
  });
});
