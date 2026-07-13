import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Exercises the operation_settings kill switch through the REAL settings
// module (unlike the other route tests, which mock it away): only the admin
// client underneath is stubbed, so the absent-row default, the disabled skip,
// and the fail-open path are all validated end-to-end at the route level.

// Hoisted so the mock factories (lifted above imports) can reference them while
// the statically-imported route module loads.
const h = vi.hoisted(() => ({
  runNewsSyncMock: vi.fn(),
  recordRunMock: vi.fn(),
  rows: [] as { kind: string; enabled: boolean }[],
  selectError: null as { message: string } | null,
}));

vi.mock("@/lib/env", () => ({
  env: {
    cronSecret: "cron-secret",
    newsApiToken: "news-token",
    supabaseUrl: "https://example.supabase.co",
  },
  requireServiceRoleKey: () => "service-role-key",
}));

vi.mock("@/lib/news-sync", () => ({
  runNewsSync: h.runNewsSyncMock,
}));

vi.mock("@/lib/operations/record-run", async (importOriginal) => {
  // Keep the real OPERATION_KINDS (settings.ts iterates them); only the
  // ledger write is faked.
  const actual = await importOriginal<typeof import("@/lib/operations/record-run")>();
  return { ...actual, recordRun: h.recordRunMock };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: (table: string) => {
      expect(table).toBe("operation_settings");
      return {
        select: async () => ({ data: h.rows, error: h.selectError }),
      };
    },
  }),
}));

import { GET } from "@/app/api/cron/sync-news/route";

function req() {
  return new Request("http://localhost/api/cron/sync-news", {
    headers: { authorization: "Bearer cron-secret" },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  h.runNewsSyncMock.mockReset().mockResolvedValue({ inserted: 2, errors: 0 });
  h.recordRunMock
    .mockReset()
    .mockImplementation(async (_kind: string, _trigger: string, fn: () => Promise<unknown>) => ({
      summary: await fn(),
    }));
  h.rows = [];
  h.selectError = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cron kill switch (GET /api/cron/sync-news)", () => {
  it("skips (204 disabled) when the job is stored as disabled, without running or recording", async () => {
    h.rows = [{ kind: "sync_news", enabled: false }];
    const res = await GET(req());
    expect(res.status).toBe(204);
    expect(res.headers.get("x-skipped")).toBe("disabled");
    expect(h.runNewsSyncMock).not.toHaveBeenCalled();
    expect(h.recordRunMock).not.toHaveBeenCalled();
  });

  it("runs normally when no settings row exists (absent = enabled)", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(h.recordRunMock).toHaveBeenCalledWith("sync_news", "cron", expect.any(Function));
    await expect(res.json()).resolves.toEqual({ inserted: 2, errors: 0 });
  });

  it("runs normally when the job is stored as enabled", async () => {
    h.rows = [{ kind: "sync_news", enabled: true }];
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(h.runNewsSyncMock).toHaveBeenCalled();
  });

  it("only a different job's disabled row does not skip this one", async () => {
    h.rows = [{ kind: "sync_matches", enabled: false }];
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(h.runNewsSyncMock).toHaveBeenCalled();
  });

  it("fails open (still runs) when the settings read errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    h.selectError = { message: "connection refused" };
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(h.runNewsSyncMock).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});
