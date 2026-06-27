import { describe, expect, it } from "vitest";
import { nextScheduledRun } from "@/lib/operations/schedule";

describe("nextScheduledRun", () => {
  it("returns null for a manual-only kind with no schedule", () => {
    expect(nextScheduledRun("score_rules_email", new Date("2026-06-27T12:00:00Z"))).toBeNull();
  });

  it("returns the next daily instant for a scheduled kind", () => {
    // sync_matches fires at 09:00 UTC. At 08:00 the next run is today 09:00.
    const next = nextScheduledRun("sync_matches", new Date("2026-06-27T08:00:00Z"));
    expect(next).not.toBeNull();
    expect(next!.toISOString()).toBe("2026-06-27T09:00:00.000Z");
  });

  it("rolls to tomorrow when today's hour has passed", () => {
    const next = nextScheduledRun("sync_matches", new Date("2026-06-27T10:00:00Z"));
    expect(next!.toISOString()).toBe("2026-06-28T09:00:00.000Z");
  });
});
