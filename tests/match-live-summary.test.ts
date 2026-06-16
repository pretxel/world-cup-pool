import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The per-match live API surfaces a stored summary when one exists and omits the
// field entirely when none does.

const clientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => clientMock()),
}));
vi.mock("@/lib/matches/live", () => ({ isLiveNow: () => false }));
vi.mock("@/lib/result-sync/opportunistic", () => ({
  maybeScheduleMatchSync: vi.fn(() => false),
}));

const MATCH_ID = "11111111-1111-4111-8111-111111111111";

function makeClient(opts: {
  match?: Record<string, unknown> | null;
  events?: unknown[];
  summary?: Record<string, unknown> | null;
}) {
  return {
    from: (table: string) => {
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
      if (table === "match_summaries") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: opts.summary ?? null, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected from(${table})`);
    },
  };
}

function call() {
  return import("@/app/api/matches/[matchId]/live/route").then(({ GET }) =>
    GET(new Request(`http://localhost/api/matches/${MATCH_ID}/live`), {
      params: Promise.resolve({ matchId: MATCH_ID }),
    }),
  );
}

const FINAL_MATCH = {
  id: MATCH_ID,
  status: "final",
  home_score: 2,
  away_score: 1,
  kickoff_at: "2026-06-11T19:00:00+00:00",
};

beforeEach(() => {
  clientMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/matches/[matchId]/live — summary", () => {
  it("includes the summary when a row exists", async () => {
    clientMock.mockReturnValue(
      makeClient({
        match: FINAL_MATCH,
        summary: {
          content: "Mexico edged Canada 2-1.",
          model: "test/model",
          locale: "en",
          generated_at: "2026-06-12T00:00:00+00:00",
        },
      }),
    );
    const res = await call();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.summary).toEqual({
      content: "Mexico edged Canada 2-1.",
      model: "test/model",
      locale: "en",
      generatedAt: "2026-06-12T00:00:00+00:00",
    });
  });

  it("omits the summary field when no row exists", async () => {
    clientMock.mockReturnValue(makeClient({ match: FINAL_MATCH, summary: null }));
    const res = await call();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.summary).toBeUndefined();
    expect("summary" in body).toBe(false);
  });

  it("404s for an unknown match", async () => {
    clientMock.mockReturnValue(makeClient({ match: null }));
    const res = await call();
    expect(res.status).toBe(404);
  });
});
