import { describe, expect, it } from "vitest";
import {
  renderScoreRulesEmail,
  type ScoreRulesPhaseRow,
  type ScoreRulesStrings,
} from "@/lib/notifications/score-rules-template";

const STRINGS: ScoreRulesStrings = {
  subject: "New scoring",
  preheader: "Points scale by stage",
  eyebrow: "Scoring update",
  heading: "We changed how points work",
  intro: "Later rounds are worth more.",
  tableLabel: "Points per phase",
  phaseHeader: "Phase",
  multHeader: "×",
  exactHeader: "Exact",
  winnerGdHeader: "Winner + GD",
  winnerHeader: "Winner",
  ctaLabel: "See full scoring",
  footer: "Turn this off in your account.",
};

const PHASES: ScoreRulesPhaseRow[] = [
  { stageLabel: "Group", multiplier: 1, exact: 5, winnerGd: 3, winner: 1 },
  { stageLabel: "Final", multiplier: 10, exact: 50, winnerGd: 30, winner: 10 },
];

describe("renderScoreRulesEmail", () => {
  it("returns the subject from strings", () => {
    const out = renderScoreRulesEmail({ phases: PHASES, strings: STRINGS, ctaUrl: "https://x/#stage-scoring" });
    expect(out.subject).toBe("New scoring");
  });

  it("renders each phase label and its points in the HTML", () => {
    const { html } = renderScoreRulesEmail({ phases: PHASES, strings: STRINGS, ctaUrl: "https://x/#stage-scoring" });
    expect(html).toContain("Group");
    expect(html).toContain("Final");
    expect(html).toContain("50"); // exact in the final
    expect(html).toContain("10×"); // final multiplier
  });

  it("includes the CTA url and label", () => {
    const { html } = renderScoreRulesEmail({ phases: PHASES, strings: STRINGS, ctaUrl: "https://x/#stage-scoring" });
    expect(html).toContain("https://x/#stage-scoring");
    expect(html).toContain("See full scoring");
  });

  it("produces a plain-text part with a row per phase", () => {
    const { text } = renderScoreRulesEmail({ phases: PHASES, strings: STRINGS, ctaUrl: "https://x/#stage-scoring" });
    expect(text).toContain("Group | 1× | 5 | 3 | 1");
    expect(text).toContain("Final | 10× | 50 | 30 | 10");
  });

  it("escapes HTML in copy", () => {
    const { html } = renderScoreRulesEmail({
      phases: PHASES,
      strings: { ...STRINGS, heading: "<b>x</b>" },
      ctaUrl: "https://x",
    });
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
