import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The cron routes now consult the operation_settings kill switch before
// running; keep it enabled here so these tests exercise the normal path.
// (vi.mock is hoisted, so placement near the top is cosmetic.)
vi.mock("@/lib/operations/settings", () => ({
  isOperationEnabled: vi.fn(async () => true),
}));


// Verifies the cron route isolates result-email dispatch: a dispatch failure
// never fails the sync, and a successful dispatch's count is surfaced.

const CRON_SECRET = "test-secret";
const dispatchMock = vi.fn();
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

vi.mock("@/lib/notifications/result-emails", () => ({
  dispatchResultEmails: dispatchMock,
}));

// The route resolves the email from-name from active branding; stub it.
vi.mock("@/lib/competition", () => ({
  getActiveBranding: vi.fn(async () => ({
    shortName: "World Cup 2026",
    siteName: "World Cup 2026 Pool",
    brandCode: "WC26",
    ogAlt: "World Cup 2026 Pool",
    emailFromName: "World Cup Pools",
    newsQuery: '"World Cup 2026" OR "FIFA World Cup 2026"',
  })),
}));

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/sync-matches", { headers });
}

beforeEach(() => {
  fromMock.mockReset();
  // No local matches → sync completes cleanly with a zeroed summary.
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
  // Both upstreams return nothing so the run stays source: "none".
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ matches: [] }), { status: 200 })),
  );
  dispatchMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("GET /api/cron/sync-matches — email dispatch isolation", () => {
  it("still returns the sync summary (2xx) when dispatch throws", async () => {
    dispatchMock.mockRejectedValue(new Error("resend down"));
    const { GET } = await import("@/app/api/cron/sync-matches/route");
    const res = await GET(makeRequest({ authorization: `Bearer ${CRON_SECRET}` }) as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.source).toBe("none");
    expect(body.emailed).toBe(0);
  });

  it("surfaces the emailed count from a successful dispatch", async () => {
    dispatchMock.mockResolvedValue({ emailed: 3, failed: 0, skipped: 1 });
    const { GET } = await import("@/app/api/cron/sync-matches/route");
    const res = await GET(makeRequest({ authorization: `Bearer ${CRON_SECRET}` }) as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.emailed).toBe(3);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });
});
