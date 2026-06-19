import { describe, expect, it } from "vitest";
import {
  currentWeekBoundsUtc,
  parseSegmentParam,
  reconcileStageParam,
  resolveSegment,
} from "@/lib/leaderboard-segment";

const STAGES = ["group", "r32", "r16", "qf", "sf", "third", "final"] as const;

describe("parseSegmentParam", () => {
  it("defaults missing/blank to overall", () => {
    expect(parseSegmentParam(undefined)).toBe("overall");
    expect(parseSegmentParam("")).toBe("overall");
  });

  it("accepts the known segments case-insensitively", () => {
    expect(parseSegmentParam("overall")).toBe("overall");
    expect(parseSegmentParam("week")).toBe("week");
    expect(parseSegmentParam("STAGE")).toBe("stage");
    expect(parseSegmentParam(" Week ")).toBe("week");
  });

  it("falls back to overall on unknown values", () => {
    expect(parseSegmentParam("bogus")).toBe("overall");
  });

  it("keeps the first recognized value of a repeated param", () => {
    expect(parseSegmentParam(["week", "stage"])).toBe("week");
    expect(parseSegmentParam(["bogus", "stage"])).toBe("stage");
  });
});

describe("reconcileStageParam", () => {
  it("returns null for missing/blank", () => {
    expect(reconcileStageParam(undefined, STAGES)).toBeNull();
    expect(reconcileStageParam("", STAGES)).toBeNull();
  });

  it("returns a valid stage key", () => {
    expect(reconcileStageParam("r16", STAGES)).toBe("r16");
    expect(reconcileStageParam(" final ", STAGES)).toBe("final");
  });

  it("drops unknown stage keys", () => {
    expect(reconcileStageParam("unknown", STAGES)).toBeNull();
    expect(reconcileStageParam("r16", [])).toBeNull();
  });

  it("keeps the first valid value of a repeated param", () => {
    expect(reconcileStageParam(["nope", "qf"], STAGES)).toBe("qf");
  });
});

describe("resolveSegment", () => {
  it("collapses a stage segment with no valid stage to overall", () => {
    expect(resolveSegment("stage", null)).toBe("overall");
  });

  it("keeps a stage segment with a valid stage", () => {
    expect(resolveSegment("stage", "r16")).toBe("stage");
  });

  it("passes through overall and week unchanged", () => {
    expect(resolveSegment("overall", null)).toBe("overall");
    expect(resolveSegment("week", null)).toBe("week");
  });
});

describe("currentWeekBoundsUtc", () => {
  it("returns a Monday-start, 7-day half-open window", () => {
    // Wednesday 2026-06-17T12:00Z → week is Mon 2026-06-15 .. Mon 2026-06-22.
    const { fromTs, toTs } = currentWeekBoundsUtc(
      new Date("2026-06-17T12:00:00.000Z"),
    );
    expect(fromTs).toBe("2026-06-15T00:00:00.000Z");
    expect(toTs).toBe("2026-06-22T00:00:00.000Z");
  });

  it("treats Monday as the first day of the week", () => {
    const { fromTs, toTs } = currentWeekBoundsUtc(
      new Date("2026-06-15T00:00:00.000Z"),
    );
    expect(fromTs).toBe("2026-06-15T00:00:00.000Z");
    expect(toTs).toBe("2026-06-22T00:00:00.000Z");
  });

  it("treats Sunday as the last day of the prior Monday's week", () => {
    // Sunday 2026-06-21 belongs to the week starting Mon 2026-06-15.
    const { fromTs, toTs } = currentWeekBoundsUtc(
      new Date("2026-06-21T23:59:59.000Z"),
    );
    expect(fromTs).toBe("2026-06-15T00:00:00.000Z");
    expect(toTs).toBe("2026-06-22T00:00:00.000Z");
  });
});
