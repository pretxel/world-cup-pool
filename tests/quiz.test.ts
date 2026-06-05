import { describe, expect, it } from "vitest";
import { computeStreak } from "@/lib/quiz";

// Fixed "now": 2026-06-06T12:00:00Z
const NOW = new Date("2026-06-06T12:00:00Z");
const day = (d: string, t = "08:00:00Z") => `2026-06-${d}T${t}`;

describe("computeStreak", () => {
  it("returns 0 for no answers", () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak([day("06"), day("05"), day("04")], NOW)).toBe(3);
  });

  it("keeps the streak alive when today is not yet answered", () => {
    // answered yesterday + day before, not today → streak still 2
    expect(computeStreak([day("05"), day("04")], NOW)).toBe(2);
  });

  it("returns 0 when neither today nor yesterday was answered", () => {
    // last answer two days ago → streak broken
    expect(computeStreak([day("04"), day("03")], NOW)).toBe(0);
  });

  it("counts only the most recent unbroken run", () => {
    // answered today, yesterday — then a gap on the 03 — older run ignored
    expect(computeStreak([day("06"), day("05"), day("03"), day("02")], NOW)).toBe(2);
  });

  it("dedupes multiple answers on the same UTC day", () => {
    expect(
      computeStreak([day("06", "01:00:00Z"), day("06", "23:00:00Z"), day("05")], NOW),
    ).toBe(2);
  });

  it("normalizes non-UTC offsets to the UTC day", () => {
    // 2026-06-07T01:00:00+03:00 === 2026-06-06T22:00:00Z → counts as today (06)
    expect(computeStreak(["2026-06-07T01:00:00+03:00", day("05")], NOW)).toBe(2);
  });
});
