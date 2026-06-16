import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The landing live endpoint (GET /api/live-matches) is the only ~30s path hit
// by every visitor, so it now schedules an opportunistic, throttled, non-
// blocking result sync for the fixtures it reports as live — mirroring the per-
// match live route. These tests assert it schedules a sync per currently-live
// fixture (never the next-up fallback), bounds the fan-out per request, and
// stays resilient: a scheduler throw must not drop the payload.

const getActiveCompetitionMock = vi.fn();
const getLiveAndNextUpMock = vi.fn();
const maybeScheduleMatchSyncMock = vi.fn();

vi.mock("@/lib/competition", () => ({
  getActiveCompetition: getActiveCompetitionMock,
}));

vi.mock("@/lib/matches/live", () => ({
  getLiveAndNextUp: getLiveAndNextUpMock,
}));

vi.mock("@/lib/result-sync/opportunistic", () => ({
  maybeScheduleMatchSync: maybeScheduleMatchSyncMock,
}));

type Fixture = { id: string; status: string };

function fixture(id: string, status = "live"): Fixture {
  return { id, status };
}

function call() {
  return import("@/app/api/live-matches/route").then(({ GET }) => GET());
}

beforeEach(() => {
  getActiveCompetitionMock.mockReset().mockResolvedValue({ id: "comp1" });
  getLiveAndNextUpMock.mockReset();
  maybeScheduleMatchSyncMock.mockReset().mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/live-matches — opportunistic sync", () => {
  it("schedules a sync once per currently-live fixture with { id, status }", async () => {
    const live = [fixture("m1"), fixture("m2", "live")];
    getLiveAndNextUpMock.mockResolvedValue({ live, nextUp: null });

    const res = await call();

    expect(res.status).toBe(200);
    expect(maybeScheduleMatchSyncMock).toHaveBeenCalledTimes(2);
    expect(maybeScheduleMatchSyncMock).toHaveBeenNthCalledWith(1, { id: "m1", status: "live" });
    expect(maybeScheduleMatchSyncMock).toHaveBeenNthCalledWith(2, { id: "m2", status: "live" });
    // Payload shape is unchanged.
    const body = (await res.json()) as { live: Fixture[]; nextUp: unknown };
    expect(body.live.map((f) => f.id)).toEqual(["m1", "m2"]);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not schedule a sync for the next-up fallback fixture", async () => {
    getLiveAndNextUpMock.mockResolvedValue({
      live: [],
      nextUp: fixture("next1", "scheduled"),
    });

    const res = await call();

    expect(res.status).toBe(200);
    expect(maybeScheduleMatchSyncMock).not.toHaveBeenCalled();
  });

  it("bounds the number of scheduled fixtures per request (cap)", async () => {
    const live = Array.from({ length: 10 }, (_, i) => fixture(`m${i}`));
    getLiveAndNextUpMock.mockResolvedValue({ live, nextUp: null });

    await call();

    // LANDING_SYNC_CAP = 6: only the first 6 live fixtures are scheduled.
    expect(maybeScheduleMatchSyncMock).toHaveBeenCalledTimes(6);
    expect(maybeScheduleMatchSyncMock.mock.calls.map((c) => c[0].id)).toEqual([
      "m0",
      "m1",
      "m2",
      "m3",
      "m4",
      "m5",
    ]);
  });

  it("still returns the live payload when scheduling throws", async () => {
    getLiveAndNextUpMock.mockResolvedValue({
      live: [fixture("m1")],
      nextUp: null,
    });
    maybeScheduleMatchSyncMock.mockImplementation(() => {
      throw new Error("after() unavailable");
    });

    const res = await call();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { live: Fixture[] };
    // Degrades to best-effort scheduling, NOT to the empty payload.
    expect(body.live.map((f) => f.id)).toEqual(["m1"]);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns an empty payload when the data read itself fails", async () => {
    getLiveAndNextUpMock.mockRejectedValue(new Error("db down"));

    const res = await call();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { live: unknown[]; nextUp: unknown };
    expect(body).toEqual({ live: [], nextUp: null });
    expect(maybeScheduleMatchSyncMock).not.toHaveBeenCalled();
  });
});
