import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const CRON_SECRET = "test-secret";
const FOOTBALL_TOKEN = "test-token";

const rpcMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    siteUrl: "http://localhost:3000",
    footballDataToken: FOOTBALL_TOKEN,
    cronSecret: CRON_SECRET,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: fromMock,
    rpc: rpcMock,
  })),
}));

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/sync-matches", { headers });
}

function setupLocalMatches(rows: unknown[]) {
  fromMock.mockImplementation((table: string) => {
    if (table === "matches") {
      return {
        select: () => Promise.resolve({ data: rows, error: null }),
        update: updateMock,
      };
    }
    throw new Error(`unexpected from(${table})`);
  });
}

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ error: null });
  eqMock.mockReset();
  eqMock.mockResolvedValue({ error: null });
  updateMock.mockReset();
  updateMock.mockImplementation(() => ({ eq: eqMock }));
  selectMock.mockReset();
  fromMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("GET /api/cron/sync-matches", () => {
  it("returns 401 when bearer is missing", async () => {
    const { GET } = await import("@/app/api/cron/sync-matches/route");
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 when bearer is wrong", async () => {
    const { GET } = await import("@/app/api/cron/sync-matches/route");
    const res = await GET(
      makeRequest({ authorization: "Bearer wrong" }) as never,
    );
    expect(res.status).toBe(401);
  });

  it("finalizes a FINISHED remote match", async () => {
    setupLocalMatches([
      {
        id: MATCH_ID,
        home_team: "Mexico",
        away_team: "South Africa",
        kickoff_at: "2026-06-11T19:00:00+00:00",
        home_score: null,
        away_score: null,
        status: "scheduled",
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            matches: [
              {
                id: 1,
                utcDate: "2026-06-11T19:00:00Z",
                status: "FINISHED",
                homeTeam: { name: "Mexico" },
                awayTeam: { name: "South Africa" },
                score: { fullTime: { home: 2, away: 1 } },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const { GET } = await import("@/app/api/cron/sync-matches/route");
    const res = await GET(
      makeRequest({ authorization: `Bearer ${CRON_SECRET}` }) as never,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(body.matched).toBe(1);
    expect(body.final).toBe(1);
    expect(body.live).toBe(0);
    expect(body.recomputed).toBe(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      home_score: 2,
      away_score: 1,
      status: "final",
    });
    expect(rpcMock).toHaveBeenCalledWith("compute_match_scores", {
      p_match_id: MATCH_ID,
    });
  });

  it("flips IN_PLAY to live when local was scheduled", async () => {
    setupLocalMatches([
      {
        id: MATCH_ID,
        home_team: "Mexico",
        away_team: "South Africa",
        kickoff_at: "2026-06-11T19:00:00+00:00",
        home_score: null,
        away_score: null,
        status: "scheduled",
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            matches: [
              {
                id: 1,
                utcDate: "2026-06-11T19:00:00Z",
                status: "IN_PLAY",
                homeTeam: { name: "Mexico" },
                awayTeam: { name: "South Africa" },
                score: { fullTime: { home: null, away: null } },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const { GET } = await import("@/app/api/cron/sync-matches/route");
    const res = await GET(
      makeRequest({ authorization: `Bearer ${CRON_SECRET}` }) as never,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(body.live).toBe(1);
    expect(body.final).toBe(0);
    expect(updateMock).toHaveBeenCalledWith({ status: "live" });
  });

  it("never downgrades a final match back to live", async () => {
    setupLocalMatches([
      {
        id: MATCH_ID,
        home_team: "Mexico",
        away_team: "South Africa",
        kickoff_at: "2026-06-11T19:00:00+00:00",
        home_score: 2,
        away_score: 1,
        status: "final",
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            matches: [
              {
                id: 1,
                utcDate: "2026-06-11T19:00:00Z",
                status: "IN_PLAY",
                homeTeam: { name: "Mexico" },
                awayTeam: { name: "South Africa" },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const { GET } = await import("@/app/api/cron/sync-matches/route");
    const res = await GET(
      makeRequest({ authorization: `Bearer ${CRON_SECRET}` }) as never,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(body.live).toBe(0);
    expect(body.final).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("logs unmatched remote rows and continues", async () => {
    setupLocalMatches([]); // no local rows
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            matches: [
              {
                id: 1,
                utcDate: "2026-06-11T19:00:00Z",
                status: "FINISHED",
                homeTeam: { name: "Atlantis" },
                awayTeam: { name: "Wakanda" },
                score: { fullTime: { home: 0, away: 0 } },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const { GET } = await import("@/app/api/cron/sync-matches/route");
    const res = await GET(
      makeRequest({ authorization: `Bearer ${CRON_SECRET}` }) as never,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(body.matched).toBe(0);
    expect(body.unmatched).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
