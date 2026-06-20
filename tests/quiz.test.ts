import { describe, expect, it } from "vitest";
import { computeStreak, localizeQuizQuestion } from "@/lib/quiz";

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

  // --- Freeze-aware ---

  it("no freeze days reproduces current behavior exactly", () => {
    expect(computeStreak([day("06"), day("05"), day("04")], NOW, new Set())).toBe(
      3,
    );
    expect(computeStreak([day("06"), day("04")], NOW, new Set())).toBe(1);
  });

  it("a single forgiven gap keeps the streak alive", () => {
    // activity on 06 (today) and 04, gap on 05 forgiven → counts through to 04 = 3
    expect(
      computeStreak([day("06"), day("04")], NOW, new Set(["2026-06-05"])),
    ).toBe(3);
  });

  it("a two-day gap with one freeze still breaks", () => {
    // activity on 06 and 03; only 05 frozen (04 still missing) → only today counts
    expect(
      computeStreak([day("06"), day("03")], NOW, new Set(["2026-06-05"])),
    ).toBe(1);
  });

  it("a freeze at the natural run-end invents no activity", () => {
    // activity only on 06 (today); 05 frozen but nothing before it → just 1
    expect(
      computeStreak([day("06")], NOW, new Set(["2026-06-05"])),
    ).toBe(1);
  });

  it("bridges a gap when the streak is anchored on yesterday", () => {
    // today (06) not answered; activity on 05 and 03, gap on 04 frozen → 3
    expect(
      computeStreak([day("05"), day("03")], NOW, new Set(["2026-06-04"])),
    ).toBe(3);
  });
});

describe("localizeQuizQuestion", () => {
  const en = {
    prompt: "Who won the 2022 World Cup?",
    options: ["Argentina", "France", "Brazil"],
  };
  const withTranslations = {
    ...en,
    translations: {
      es: {
        prompt: "¿Quién ganó el Mundial 2022?",
        options: ["Argentina", "Francia", "Brasil"],
      },
      fr: {
        prompt: "Qui a gagné la Coupe du monde 2022 ?",
        options: ["Argentine", "France", "Brésil"],
      },
    },
  };

  it("returns the English base columns for en", () => {
    expect(localizeQuizQuestion(withTranslations, "en")).toEqual(en);
  });

  it("serves the Spanish translation for es", () => {
    expect(localizeQuizQuestion(withTranslations, "es")).toEqual({
      prompt: "¿Quién ganó el Mundial 2022?",
      options: ["Argentina", "Francia", "Brasil"],
    });
  });

  it("serves the French translation for fr", () => {
    expect(localizeQuizQuestion(withTranslations, "fr").prompt).toBe(
      "Qui a gagné la Coupe du monde 2022 ?",
    );
  });

  it("falls back to English when the locale has no translation", () => {
    expect(localizeQuizQuestion({ ...en, translations: {} }, "fr")).toEqual(en);
    expect(localizeQuizQuestion(en, "es")).toEqual(en);
  });

  it("falls back fully when option count mismatches (index safety)", () => {
    const bad = {
      ...en,
      translations: { es: { prompt: "P", options: ["uno", "dos"] } },
    };
    expect(localizeQuizQuestion(bad, "es")).toEqual(en);
  });

  it("falls back fully when a translated option is blank", () => {
    const bad = {
      ...en,
      translations: { es: { prompt: "P", options: ["uno", "", "tres"] } },
    };
    expect(localizeQuizQuestion(bad, "es")).toEqual(en);
  });

  it("falls back when the translation prompt is blank", () => {
    const bad = {
      ...en,
      translations: { es: { prompt: "  ", options: ["a", "b", "c"] } },
    };
    expect(localizeQuizQuestion(bad, "es")).toEqual(en);
  });

  it("falls back on malformed translations JSON shapes", () => {
    expect(localizeQuizQuestion({ ...en, translations: null }, "es")).toEqual(en);
    expect(
      localizeQuizQuestion({ ...en, translations: "nope" }, "es"),
    ).toEqual(en);
    expect(
      localizeQuizQuestion({ ...en, translations: { es: 42 } }, "es"),
    ).toEqual(en);
    expect(
      localizeQuizQuestion(
        { ...en, translations: { es: { prompt: "P" } } },
        "es",
      ),
    ).toEqual(en);
  });
});
