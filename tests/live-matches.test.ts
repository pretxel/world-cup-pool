import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Rows the mocked Supabase query resolves to; each test sets this. The query
// chain in lib/matches/live.ts is from().select().eq().order(), where order()
// is the awaited thenable returning { data }.
let ROWS: unknown[] = [];
const orderMock = vi.fn(async () => ({ data: ROWS }));
const builder = {
  eq: vi.fn(() => builder),
  order: orderMock,
};

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    from: vi.fn(() => ({ select: vi.fn(() => builder) })),
  })),
}));

import { getLiveAndNextUp, type LiveFixture } from "@/lib/matches/live";

const NOW = new Date("2026-06-14T18:00:00.000Z");

function iso(offsetMinutes: number): string {
  return new Date(NOW.getTime() + offsetMinutes * 60_000).toISOString();
}

let seq = 0;
function row(overrides: Partial<LiveFixture> = {}): LiveFixture {
  seq += 1;
  return {
    id: `match-${seq}`,
    home_team: "Brazil",
    away_team: "France",
    home_score: null,
    away_score: null,
    kickoff_at: iso(0),
    status: "scheduled",
    stage: "group",
    group_code: "A",
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  ROWS = [];
  seq = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getLiveAndNextUp", () => {
  it("includes a fixture flagged live", async () => {
    const m = row({ status: "live", home_score: 1, away_score: 0 });
    ROWS = [m];
    const { live } = await getLiveAndNextUp();
    expect(live.map((f) => f.id)).toEqual([m.id]);
  });

  it("treats a kicked-off scheduled fixture as live", async () => {
    const kicked = row({ status: "scheduled", kickoff_at: iso(-30) });
    ROWS = [kicked];
    const { live } = await getLiveAndNextUp();
    expect(live.map((f) => f.id)).toEqual([kicked.id]);
  });

  it("excludes final and cancelled fixtures from the live list", async () => {
    ROWS = [
      row({ status: "final", kickoff_at: iso(-120) }),
      row({ status: "cancelled", kickoff_at: iso(-30) }),
    ];
    const { live } = await getLiveAndNextUp();
    expect(live).toEqual([]);
  });

  it("excludes placeholder bracket slots from live and next-up", async () => {
    ROWS = [
      row({
        status: "live",
        home_team: "Winner R32-1",
        away_team: "Winner R32-2",
      }),
      row({
        status: "scheduled",
        home_team: "2nd Group A",
        away_team: "1st Group B",
        kickoff_at: iso(60),
      }),
    ];
    const { live, nextUp } = await getLiveAndNextUp();
    expect(live).toEqual([]);
    expect(nextUp).toBeNull();
  });

  it("returns the soonest upcoming confirmed fixture as next-up", async () => {
    const soon = row({ status: "scheduled", kickoff_at: iso(45) });
    const later = row({ status: "scheduled", kickoff_at: iso(180) });
    ROWS = [soon, later];
    const { live, nextUp } = await getLiveAndNextUp();
    expect(live).toEqual([]);
    expect(nextUp?.id).toBe(soon.id);
  });

  it("orders multiple live fixtures by kickoff ascending", async () => {
    const earlier = row({ status: "live", kickoff_at: iso(-60) });
    const later = row({ status: "live", kickoff_at: iso(-10) });
    ROWS = [earlier, later];
    const { live } = await getLiveAndNextUp();
    expect(live.map((f) => f.id)).toEqual([earlier.id, later.id]);
  });
});
