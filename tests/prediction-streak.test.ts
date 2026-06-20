import { describe, expect, it } from "vitest";
import { computePredictionStreak } from "@/lib/prediction-streak";

// Fixed "now": 2026-06-06T12:00:00Z — a Saturday. The Monday-anchored UTC week
// containing it is [2026-06-01, 2026-06-08), so days 01–07 count this week.
const NOW = new Date("2026-06-06T12:00:00Z");
const day = (d: string, t = "08:00:00Z") => `2026-06-${d}T${t}`;

describe("computePredictionStreak", () => {
  it("returns 0 for no predictions", () => {
    expect(computePredictionStreak([], NOW)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(computePredictionStreak([day("06"), day("05"), day("04")], NOW)).toBe(3);
  });

  it("keeps the streak alive when today is not yet predicted", () => {
    // predicted yesterday + day before, not today → streak still 2
    expect(computePredictionStreak([day("05"), day("04")], NOW)).toBe(2);
  });

  it("returns 0 when neither today nor yesterday was predicted", () => {
    // last pick two days ago → streak broken
    expect(computePredictionStreak([day("04"), day("03")], NOW)).toBe(0);
  });

  it("counts only the most recent unbroken run", () => {
    // predicted today, yesterday — then a gap on the 03 — older run ignored
    expect(
      computePredictionStreak([day("06"), day("05"), day("03"), day("02")], NOW),
    ).toBe(2);
  });

  it("dedupes multiple predictions on the same UTC day", () => {
    expect(
      computePredictionStreak(
        [day("06", "01:00:00Z"), day("06", "23:00:00Z"), day("05")],
        NOW,
      ),
    ).toBe(2);
  });

  it("normalizes non-UTC offsets to the UTC day", () => {
    // 2026-06-07T01:00:00+03:00 === 2026-06-06T22:00:00Z → counts as today (06)
    expect(
      computePredictionStreak(["2026-06-07T01:00:00+03:00", day("05")], NOW),
    ).toBe(2);
  });

  // --- Weekly reset ---

  it("excludes predictions from the prior week", () => {
    // NOW is Tuesday 2026-06-02; pick today, plus last Sat/Sun (prior week).
    const tuesday = new Date("2026-06-02T12:00:00Z");
    expect(
      computePredictionStreak(
        [
          "2026-06-02T08:00:00Z", // this week (Tue)
          "2026-05-31T08:00:00Z", // last Sunday — prior week
          "2026-05-30T08:00:00Z", // last Saturday — prior week
        ],
        tuesday,
      ),
    ).toBe(1);
  });

  it("resets to 0 on a fresh Monday with no pick yet this week", () => {
    // NOW is Monday 2026-06-08; most recent pick was last week.
    const monday = new Date("2026-06-08T12:00:00Z");
    expect(
      computePredictionStreak(
        ["2026-06-07T08:00:00Z", "2026-06-06T08:00:00Z"],
        monday,
      ),
    ).toBe(0);
  });

  it("caps the streak at the days elapsed in the week (<= 7)", () => {
    // NOW is Sunday 2026-06-07; picks every UTC day Mon→Sun this week.
    const sunday = new Date("2026-06-07T12:00:00Z");
    const everyDay = ["01", "02", "03", "04", "05", "06", "07"].map((d) =>
      day(d),
    );
    expect(computePredictionStreak(everyDay, sunday)).toBe(7);
    expect(computePredictionStreak(everyDay, sunday)).toBeLessThanOrEqual(7);
  });

  // --- Freeze-aware ---

  it("no freeze days reproduces current behavior exactly", () => {
    expect(
      computePredictionStreak([day("06"), day("05"), day("04")], NOW, new Set()),
    ).toBe(3);
  });

  it("a single forgiven gap inside the week keeps the streak alive", () => {
    // picks on 06 (today) and 04, gap on 05 forgiven → 3
    expect(
      computePredictionStreak([day("06"), day("04")], NOW, new Set(["2026-06-05"])),
    ).toBe(3);
  });

  it("a two-day gap with one freeze still breaks", () => {
    expect(
      computePredictionStreak([day("06"), day("03")], NOW, new Set(["2026-06-05"])),
    ).toBe(1);
  });

  it("a freeze never invents activity at the run end", () => {
    expect(
      computePredictionStreak([day("06")], NOW, new Set(["2026-06-05"])),
    ).toBe(1);
  });

  it("a freeze cannot bridge into the prior week (weekly cap preserved)", () => {
    // NOW Monday 2026-06-08; today's pick only, last week's 06-07 frozen. The
    // probe day before the gap is outside the week → no bridge.
    const monday = new Date("2026-06-08T12:00:00Z");
    expect(
      computePredictionStreak(
        ["2026-06-08T08:00:00Z"],
        monday,
        new Set(["2026-06-07"]),
      ),
    ).toBe(1);
  });
});
