import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The cron routes now consult the operation_settings kill switch before
// running; keep it enabled here so these tests exercise the normal path.
// (vi.mock is hoisted, so placement near the top is cosmetic.)
vi.mock("@/lib/operations/settings", () => ({
  isOperationEnabled: vi.fn(async () => true),
}));


// Verifies the cron route isolates AI summary generation: a generation failure
// never fails the sync (score writes have already committed), and a successful
// pass's generated count is surfaced.

const CRON_SECRET = "test-secret";
const summariesMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    siteUrl: "http://localhost:3000",
    footballDataToken: "test-token",
    cronSecret: CRON_SECRET,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({ from: fromMock })),
}));

vi.mock("@/lib/matches/match-summary", () => ({
  generatePendingSummaries: summariesMock,
}));

vi.mock("@/lib/notifications/result-emails", () => ({
  dispatchResultEmails: vi.fn(async () => ({ emailed: 0, failed: 0, skipped: 0 })),
}));

vi.mock("@/lib/competition", () => ({
  getActiveBranding: vi.fn(async () => ({ emailFromName: "World Cup Pools" })),
}));

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/sync-matches", { headers });
}

beforeEach(() => {
  fromMock.mockReset();
  fromMock.mockImplementation((table: string) => {
    if (table === "competitions") {
      const c: Record<string, unknown> = {
        select: () => c,
        eq: () => c,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      };
      return c;
    }
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      then: (
        onF: (v: { data: unknown[]; error: null }) => unknown,
        onR?: (e: unknown) => unknown,
      ) => Promise.resolve({ data: [], error: null }).then(onF, onR),
    };
    return chain;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ matches: [] }), { status: 200 })),
  );
  summariesMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("GET /api/cron/sync-matches — summary generation isolation", () => {
  it("still returns the sync summary (2xx) when generation throws", async () => {
    summariesMock.mockRejectedValue(new Error("openrouter down"));
    const { GET } = await import("@/app/api/cron/sync-matches/route");
    const res = await GET(makeRequest({ authorization: `Bearer ${CRON_SECRET}` }) as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.source).toBe("none");
    expect(body.summaries).toBe(0);
  });

  it("surfaces the generated count from a successful pass", async () => {
    summariesMock.mockResolvedValue({ candidates: 2, generated: 2, skipped: 0, errors: 0 });
    const { GET } = await import("@/app/api/cron/sync-matches/route");
    const res = await GET(makeRequest({ authorization: `Bearer ${CRON_SECRET}` }) as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.summaries).toBe(2);
    expect(summariesMock).toHaveBeenCalledTimes(1);
  });
});
