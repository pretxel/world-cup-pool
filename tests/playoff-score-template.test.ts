import { describe, expect, it } from "vitest";
import {
  renderPlayoffScoreEmail,
  type PlayoffScoreData,
  type PlayoffScoreStrings,
} from "@/lib/notifications/playoff-score-template";

// ---------------------------------------------------------------------------
// renderPlayoffScoreEmail — pure, scoreline-only renderer
// ---------------------------------------------------------------------------

const STRINGS: PlayoffScoreStrings = {
  subject: "Saturday's playoff results",
  preheader: "The final scores from today's knockout matches.",
  eyebrow: "Playoff results",
  heading: "Saturday's knockout scores",
  intro: "Here are the final scores from today's playoff matches.",
  resultsLabel: "Results",
  scoreSeparator: "–",
  ctaLabel: "View the bracket",
  footer: "You're getting this because the knockout rounds are underway.",
};

function makeData(overrides: Partial<PlayoffScoreData> = {}): PlayoffScoreData {
  return {
    matches: [
      { home: "Brazil", away: "Spain", homeScore: 2, awayScore: 1 },
      { home: "France", away: "Argentina", homeScore: 0, awayScore: 0 },
    ],
    strings: STRINGS,
    bracketUrl: "https://example.com/en/bracket",
    ...overrides,
  };
}

describe("renderPlayoffScoreEmail", () => {
  it("returns subject, html, and text", () => {
    const out = renderPlayoffScoreEmail(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("<!DOCTYPE html>");
    expect(typeof out.text).toBe("string");
  });

  it("renders each match's team names and final scoreline", () => {
    const { html, text } = renderPlayoffScoreEmail(makeData());
    expect(html).toContain("Brazil");
    expect(html).toContain("Spain");
    expect(html).toContain("2 – 1");
    expect(html).toContain("0 – 0");
    expect(text).toContain("Brazil 2 – 1 Spain");
  });

  it("renders a decider note when present", () => {
    const { html, text } = renderPlayoffScoreEmail(
      makeData({
        matches: [
          { home: "Brazil", away: "Spain", homeScore: 1, awayScore: 1, resultNote: "Brazil won on penalties" },
        ],
      }),
    );
    expect(html).toContain("Brazil won on penalties");
    expect(text).toContain("(Brazil won on penalties)");
  });

  it("omits points, rank, and bracket-progression sections (scoreline only)", () => {
    const { html } = renderPlayoffScoreEmail(makeData());
    // None of the digest/result-email vocabulary should leak in.
    expect(html).not.toMatch(/rank/i);
    expect(html).not.toMatch(/points/i);
    expect(html).not.toMatch(/advanc/i);
    expect(html).not.toMatch(/exact hit|winner_gd/i);
  });

  it("uses email-safe fixed hex colors only — no oklch, var(), or stylesheet", () => {
    const { html } = renderPlayoffScoreEmail(makeData());
    expect(html).not.toContain("oklch");
    expect(html).not.toContain("var(");
    expect(html).not.toContain("<style");
    expect(html).toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it("HTML-escapes interpolated team names and copy", () => {
    const { html } = renderPlayoffScoreEmail(
      makeData({
        matches: [{ home: "A & B <x>", away: "C \"D\"", homeScore: 3, awayScore: 2 }],
      }),
    );
    expect(html).toContain("A &amp; B &lt;x&gt;");
    expect(html).toContain("C &quot;D&quot;");
    expect(html).not.toContain("<x>");
  });

  it("links the CTA to the bracket url", () => {
    const { html, text } = renderPlayoffScoreEmail(makeData());
    expect(html).toContain('href="https://example.com/en/bracket"');
    expect(text).toContain("https://example.com/en/bracket");
  });

  it("renders an em dash for a missing score without throwing", () => {
    const { html } = renderPlayoffScoreEmail(
      makeData({ matches: [{ home: "X", away: "Y", homeScore: null, awayScore: null }] }),
    );
    expect(html).toContain("— – —");
  });
});
