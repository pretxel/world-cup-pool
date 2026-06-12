import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2026-06-12T12:00:00Z");

const afterMock = vi.fn();
const runSyncMock = vi.fn();

vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/lib/result-sync/core", () => ({ runSync: runSyncMock }));

// Kicked off 5h before NOW with no result — stale.
const staleMatch = {
  kickoff_at: "2026-06-12T07:00:00+00:00",
  status: "scheduled",
  home_team: "Mexico",
  away_team: "South Africa",
};

const finalMatch = { ...staleMatch, status: "final" };

// The debounce lives in module state, so each test gets a fresh module.
async function freshModule() {
  vi.resetModules();
  return import("@/lib/result-sync/opportunistic");
}

beforeEach(() => {
  afterMock.mockReset();
  runSyncMock.mockReset();
  runSyncMock.mockResolvedValue({ source: "espn" });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("maybeScheduleOpportunisticSync", () => {
  it("schedules a post-response run when a stale match is present", async () => {
    const { maybeScheduleOpportunisticSync } = await freshModule();

    expect(maybeScheduleOpportunisticSync([staleMatch], NOW)).toBe(true);
    expect(afterMock).toHaveBeenCalledTimes(1);

    // The scheduled callback actually runs the sync.
    await afterMock.mock.calls[0][0]();
    expect(runSyncMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no match is stale", async () => {
    const { maybeScheduleOpportunisticSync } = await freshModule();

    expect(maybeScheduleOpportunisticSync([finalMatch], NOW)).toBe(false);
    expect(maybeScheduleOpportunisticSync([], NOW)).toBe(false);
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("debounces repeat triggers within five minutes per instance", async () => {
    const { maybeScheduleOpportunisticSync } = await freshModule();

    expect(maybeScheduleOpportunisticSync([staleMatch], NOW)).toBe(true);
    const fourMinLater = new Date(NOW.getTime() + 4 * 60 * 1000);
    expect(maybeScheduleOpportunisticSync([staleMatch], fourMinLater)).toBe(
      false,
    );
    const sixMinLater = new Date(NOW.getTime() + 6 * 60 * 1000);
    expect(maybeScheduleOpportunisticSync([staleMatch], sixMinLater)).toBe(
      true,
    );
    expect(afterMock).toHaveBeenCalledTimes(2);
  });

  it("survives a failing sync run without surfacing the error", async () => {
    const { maybeScheduleOpportunisticSync } = await freshModule();
    runSyncMock.mockRejectedValueOnce(new Error("providers down"));

    maybeScheduleOpportunisticSync([staleMatch], NOW);
    await expect(afterMock.mock.calls[0][0]()).resolves.toBeUndefined();
  });
});
