import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isLocked, lockReason } from "@/lib/match-utils";

const FIXED_NOW = new Date("2026-06-15T12:00:00.000Z").getTime();
const FUTURE = new Date("2026-06-15T18:00:00.000Z").toISOString();
const PAST = new Date("2026-06-15T06:00:00.000Z").toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("lockReason", () => {
  it("returns null for a scheduled match before kickoff", () => {
    expect(lockReason({ status: "scheduled", kickoff_at: FUTURE })).toBeNull();
  });

  it("returns 'kickoff' for a scheduled match at/after kickoff", () => {
    expect(lockReason({ status: "scheduled", kickoff_at: PAST })).toBe("kickoff");
  });

  it("returns 'live' regardless of kickoff", () => {
    expect(lockReason({ status: "live", kickoff_at: FUTURE })).toBe("live");
    expect(lockReason({ status: "live", kickoff_at: PAST })).toBe("live");
  });

  it("returns 'final' regardless of kickoff", () => {
    expect(lockReason({ status: "final", kickoff_at: FUTURE })).toBe("final");
    expect(lockReason({ status: "final", kickoff_at: PAST })).toBe("final");
  });

  it("returns 'cancelled' regardless of kickoff", () => {
    expect(lockReason({ status: "cancelled", kickoff_at: FUTURE })).toBe(
      "cancelled",
    );
    expect(lockReason({ status: "cancelled", kickoff_at: PAST })).toBe(
      "cancelled",
    );
  });
});

describe("isLocked", () => {
  it("is false for scheduled + future kickoff", () => {
    expect(isLocked({ status: "scheduled", kickoff_at: FUTURE })).toBe(false);
  });

  it("is true for scheduled + past kickoff", () => {
    expect(isLocked({ status: "scheduled", kickoff_at: PAST })).toBe(true);
  });

  it("is true for live/final/cancelled with future kickoff", () => {
    expect(isLocked({ status: "live", kickoff_at: FUTURE })).toBe(true);
    expect(isLocked({ status: "final", kickoff_at: FUTURE })).toBe(true);
    expect(isLocked({ status: "cancelled", kickoff_at: FUTURE })).toBe(true);
  });
});
