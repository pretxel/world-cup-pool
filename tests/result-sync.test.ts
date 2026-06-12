import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteMatch, ResultProvider } from "@/lib/result-sync/types";

const NOW = new Date("2026-06-12T12:00:00Z");
const MATCH_A = "11111111-1111-4111-8111-111111111111";
const MATCH_B = "22222222-2222-4222-8222-222222222222";

const rpcMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const neqMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    siteUrl: "http://localhost:3000",
    footballDataToken: "test-token",
    cronSecret: "test-secret",
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: fromMock,
    rpc: rpcMock,
  })),
}));

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

// Stale relative to NOW (kicked off 5h earlier); finished matches share it.
const STALE_KICKOFF = "2026-06-12T07:00:00+00:00";

function localMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH_A,
    home_team: "Mexico",
    away_team: "South Africa",
    kickoff_at: STALE_KICKOFF,
    home_score: null,
    away_score: null,
    status: "scheduled",
    ...overrides,
  };
}

function finishedRemote(overrides: Partial<RemoteMatch> = {}): RemoteMatch {
  return {
    id: 1,
    utcDate: "2026-06-12T07:00:00Z",
    status: "FINISHED",
    homeTeam: { name: "Mexico" },
    awayTeam: { name: "South Africa" },
    score: { fullTime: { home: 2, away: 1 } },
    ...overrides,
  };
}

// Test double standing in for football-data ("primary") or espn ("fallback");
// `name` must be one of the real provider names since core keys decisions on it.
function provider(
  name: "football-data" | "espn",
  fetchImpl: (dates?: string[]) => Promise<RemoteMatch[]>,
  available = true,
): ResultProvider & { calls: Array<string[] | undefined> } {
  const calls: Array<string[] | undefined> = [];
  return {
    name,
    calls,
    available: () => available,
    fetchMatches: (dates?: string[]) => {
      calls.push(dates);
      return fetchImpl(dates);
    },
  };
}

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ error: null });
  neqMock.mockReset();
  neqMock.mockResolvedValue({ error: null });
  eqMock.mockReset();
  // Sync writes chain .eq(id).neq("status", "final").
  eqMock.mockImplementation(() => ({ neq: neqMock }));
  updateMock.mockReset();
  updateMock.mockImplementation(() => ({ eq: eqMock }));
  fromMock.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("runSync provider escalation", () => {
  it("uses the primary when it succeeds and skips the fallback entirely", async () => {
    setupLocalMatches([localMatch()]);
    const primary = provider("football-data", async () => [finishedRemote()]);
    const fallback = provider("espn", async () => []);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    expect(summary.source).toBe("football-data");
    expect(summary.final).toBe(1);
    expect(summary.stale).toBe(0);
    expect(summary.staleResolved).toBe(1);
    expect(fallback.calls).toHaveLength(0);
  });

  it("runs fully from the fallback when the primary throws", async () => {
    setupLocalMatches([localMatch()]);
    const primary = provider("football-data", async () => {
      throw new Error("503 Service Unavailable");
    });
    const fallback = provider("espn", async () => [finishedRemote()]);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    expect(summary.source).toBe("espn");
    expect(summary.errors).toBe(1);
    expect(summary.final).toBe(1);
    expect(summary.stale).toBe(0);
  });

  it("runs fully from the fallback when the primary returns zero matches", async () => {
    setupLocalMatches([localMatch()]);
    const primary = provider("football-data", async () => []);
    const fallback = provider("espn", async () => [finishedRemote()]);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    expect(summary.source).toBe("espn");
    expect(summary.errors).toBe(0);
    expect(summary.final).toBe(1);
  });

  it("reports source none with no writes when every provider fails", async () => {
    setupLocalMatches([localMatch()]);
    const primary = provider("football-data", async () => {
      throw new Error("down");
    });
    const fallback = provider("espn", async () => {
      throw new Error("also down");
    });

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    expect(summary.source).toBe("none");
    expect(summary.errors).toBe(2);
    expect(summary.final).toBe(0);
    expect(summary.stale).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("escalates to a targeted fallback fetch for matches the primary left stale", async () => {
    setupLocalMatches([
      localMatch(),
      localMatch({
        id: MATCH_B,
        home_team: "Canada",
        away_team: "Bosnia and Herzegovina",
        kickoff_at: "2026-06-11T19:00:00+00:00",
      }),
    ]);
    // Primary knows about match A only; B stays stale after the main apply.
    const primary = provider("football-data", async () => [finishedRemote()]);
    const fallback = provider("espn", async () => [
      finishedRemote({
        id: 2,
        utcDate: "2026-06-11T19:00Z",
        homeTeam: { name: "Canada" },
        awayTeam: { name: "Bosnia-Herzegovina" }, // ESPN spelling → alias table
        score: { fullTime: { home: 3, away: 0 } },
      }),
    ]);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    // Fallback got asked about exactly the stale match's date.
    expect(fallback.calls).toEqual([["2026-06-11"]]);
    expect(summary.source).toBe("espn");
    expect(summary.final).toBe(2);
    expect(summary.stale).toBe(0);
    expect(summary.staleResolved).toBe(2);
    expect(updateMock).toHaveBeenCalledWith({
      home_score: 3,
      away_score: 0,
      status: "final",
    });
  });

  it("keeps the primary as source when the targeted escalation resolves nothing", async () => {
    setupLocalMatches([
      localMatch({ status: "live" }),
    ]);
    // Primary returns the match still in play; fallback has nothing new.
    const primary = provider("football-data", async () => [
      finishedRemote({ status: "IN_PLAY", score: null }),
    ]);
    const fallback = provider("espn", async () => []);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    expect(fallback.calls).toEqual([["2026-06-12"]]);
    expect(summary.source).toBe("football-data");
    expect(summary.stale).toBe(1);
    expect(summary.staleResolved).toBe(0);
  });

  it("skips unavailable providers without errors", async () => {
    setupLocalMatches([localMatch()]);
    const primary = provider(
      "football-data",
      async () => [finishedRemote()],
      false, // token missing
    );
    const fallback = provider("espn", async () => [finishedRemote()]);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    expect(primary.calls).toHaveLength(0);
    expect(summary.source).toBe("espn");
    expect(summary.errors).toBe(0);
    expect(summary.final).toBe(1);
  });
});

describe("runSync cross-source final protection", () => {
  it("never lets the fallback overwrite an existing final", async () => {
    setupLocalMatches([
      localMatch({ status: "final", home_score: 2, away_score: 1 }),
    ]);
    const primary = provider("football-data", async () => {
      throw new Error("down");
    });
    const fallback = provider("espn", async () => [
      finishedRemote({ score: { fullTime: { home: 0, away: 0 } } }),
    ]);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    expect(summary.final).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("never lets the primary overwrite a differing final either — finals are immutable to feeds", async () => {
    setupLocalMatches([
      localMatch({ status: "final", home_score: 2, away_score: 1 }),
    ]);
    const primary = provider("football-data", async () => [
      finishedRemote({ score: { fullTime: { home: 3, away: 1 } } }),
    ]);
    const fallback = provider("espn", async () => []);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    expect(summary.final).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("issues no UPDATE for an identical final but still recomputes (heals a failed RPC)", async () => {
    setupLocalMatches([
      localMatch({ status: "final", home_score: 2, away_score: 1 }),
    ]);
    const primary = provider("football-data", async () => [finishedRemote()]);
    const fallback = provider("espn", async () => []);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    expect(summary.matched).toBe(1);
    expect(summary.final).toBe(0);
    expect(summary.recomputed).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledExactlyOnceWith("compute_match_scores", {
      p_match_id: MATCH_A,
    });
  });
});

describe("runSync status mapping and error paths", () => {
  it("finalizes an AWARDED remote match", async () => {
    setupLocalMatches([localMatch()]);
    const primary = provider("football-data", async () => [
      finishedRemote({ status: "AWARDED", score: { fullTime: { home: 3, away: 0 } } }),
    ]);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary], now: NOW });

    expect(summary.final).toBe(1);
    expect(updateMock).toHaveBeenCalledWith({
      home_score: 3,
      away_score: 0,
      status: "final",
    });
  });

  it("flips a PAUSED remote match to live", async () => {
    setupLocalMatches([localMatch()]);
    const primary = provider("football-data", async () => [
      finishedRemote({ status: "PAUSED", score: null }),
    ]);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary], now: NOW });

    expect(summary.live).toBe(1);
    expect(updateMock).toHaveBeenCalledWith({ status: "live" });
  });

  it("counts a failed UPDATE as an error and skips its recompute", async () => {
    setupLocalMatches([localMatch()]);
    neqMock.mockResolvedValue({ error: { message: "db down" } });
    const primary = provider("football-data", async () => [finishedRemote()]);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary], now: NOW });

    expect(summary.errors).toBe(1);
    expect(summary.final).toBe(0);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("counts a failed recompute RPC as an error after a successful write", async () => {
    setupLocalMatches([localMatch()]);
    rpcMock.mockResolvedValue({ error: { message: "rpc down" } });
    const primary = provider("football-data", async () => [finishedRemote()]);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary], now: NOW });

    expect(summary.final).toBe(1);
    expect(summary.recomputed).toBe(0);
    expect(summary.errors).toBe(1);
  });

  it("reports source none when the fallback responds OK but with zero matches", async () => {
    setupLocalMatches([localMatch()]);
    const primary = provider("football-data", async () => {
      throw new Error("down");
    });
    const fallback = provider("espn", async () => []);

    const { runSync } = await import("@/lib/result-sync/core");
    const summary = await runSync({ providers: [primary, fallback], now: NOW });

    expect(summary.source).toBe("none");
    expect(summary.fetched).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("caps fallback candidate dates at 14, newest first", async () => {
    // 20 stale matches on 20 distinct past days, 2026-05-10 .. 2026-05-29.
    const dayMs = 24 * 60 * 60 * 1000;
    const first = Date.parse("2026-05-10T19:00:00Z");
    setupLocalMatches(
      Array.from({ length: 20 }, (_, i) => {
        const iso = new Date(first + i * dayMs).toISOString();
        return localMatch({
          id: `33333333-3333-4333-8333-3333333333${String(i).padStart(2, "0")}`,
          kickoff_at: iso.replace("Z", "+00:00"),
        });
      }),
    );
    const fallbackOnly = provider("espn", async () => []);

    const { runSync } = await import("@/lib/result-sync/core");
    await runSync({ providers: [fallbackOnly], now: NOW });

    const dates = fallbackOnly.calls[0];
    expect(dates).toHaveLength(14);
    expect(dates?.[0]).toBe("2026-05-29");
    expect(dates?.[13]).toBe("2026-05-16");
  });
});

describe("findStaleMatches", () => {
  it("flags overdue scheduled and live matches", async () => {
    const { findStaleMatches } = await import("@/lib/result-sync/staleness");
    const stale = findStaleMatches(
      [
        localMatch(),
        localMatch({ id: MATCH_B, status: "live" }),
      ],
      NOW,
    );
    expect(stale).toHaveLength(2);
  });

  it("excludes placeholder fixtures, finals, cancellations, and recent kickoffs", async () => {
    const { findStaleMatches } = await import("@/lib/result-sync/staleness");
    const stale = findStaleMatches(
      [
        localMatch({ home_team: "2nd Group A", away_team: "Winner Match 73" }),
        localMatch({ status: "final" }),
        localMatch({ status: "cancelled" }),
        // Kicked off 1h before NOW — could still be in play.
        localMatch({ kickoff_at: "2026-06-12T11:00:00+00:00" }),
        localMatch({ kickoff_at: "2026-06-13T19:00:00+00:00" }), // future
      ],
      NOW,
    );
    expect(stale).toHaveLength(0);
  });
});

describe("espn provider", () => {
  it("normalizes the captured scoreboard fixture", async () => {
    const { normalizeEspnEvents } = await import(
      "@/lib/result-sync/providers/espn"
    );
    const fixture = JSON.parse(
      readFileSync(
        join(__dirname, "fixtures", "espn-scoreboard-20260611.json"),
        "utf-8",
      ),
    ) as { events: unknown[] };

    const remote = normalizeEspnEvents(fixture.events as never);
    expect(remote).toHaveLength(2);

    const finished = remote.find((m) => m.status === "FINISHED");
    expect(finished?.homeTeam?.name).toBe("Mexico");
    expect(finished?.awayTeam?.name).toBe("South Africa");
    expect(finished?.score?.fullTime).toEqual({ home: 2, away: 0 });
    expect(finished?.utcDate?.slice(0, 10)).toBe("2026-06-11");

    const scheduled = remote.find((m) => m.status === "SCHEDULED");
    expect(scheduled?.homeTeam?.name).toBe("South Korea");
    expect(scheduled?.score).toBeNull();
  });

  it("fetches one range widened a day back for ESPN's US-Eastern day bucketing", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ events: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { espnProvider } = await import("@/lib/result-sync/providers/espn");

    // A 01:00Z kickoff on the 12th lives under ESPN's June-11 Eastern day,
    // so the range must start one day before the earliest UTC date.
    await espnProvider.fetchMatches(["2026-06-12", "2026-06-11"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "dates=20260610-20260612",
    );

    // No dates → nothing to ask for, no request.
    fetchMock.mockClear();
    await expect(espnProvider.fetchMatches([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    await expect(espnProvider.fetchMatches(["2026-06-11"])).rejects.toThrow(
      /ESPN fetch failed/,
    );
    vi.unstubAllGlobals();
  });

  it("skips degenerate events and keeps scores null until completed", async () => {
    const { normalizeEspnEvents } = await import(
      "@/lib/result-sync/providers/espn"
    );
    const remote = normalizeEspnEvents([
      {}, // no competitions at all
      { date: "2026-06-11T19:00Z", competitions: [{ competitors: [] }] },
      {
        // in-play: no fullTime score should be emitted
        id: "9",
        date: "2026-06-11T19:00Z",
        status: { type: { state: "in", completed: false } },
        competitions: [
          {
            competitors: [
              { homeAway: "home", score: "1", team: { displayName: "Mexico" } },
              {
                homeAway: "away",
                score: "0",
                team: { displayName: "South Africa" },
              },
            ],
          },
        ],
      },
      {
        // post but with a malformed score string → null, core will not write
        id: "10",
        date: "2026-06-11T22:00Z",
        status: { type: { state: "post", completed: true } },
        competitions: [
          {
            competitors: [
              { homeAway: "home", score: "x", team: { displayName: "Canada" } },
              {
                homeAway: "away",
                score: "2",
                team: { displayName: "Qatar" },
              },
            ],
          },
        ],
      },
    ] as never);

    expect(remote).toHaveLength(2);
    expect(remote[0].status).toBe("IN_PLAY");
    expect(remote[0].score).toBeNull();
    expect(remote[1].status).toBe("FINISHED");
    expect(remote[1].score?.fullTime).toEqual({ home: null, away: 2 });
  });
});
