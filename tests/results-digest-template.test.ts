import { describe, expect, it } from "vitest";
import {
  renderResultsDigest,
  type ResultsDigestData,
  type ResultsDigestStrings,
} from "@/lib/notifications/results-digest-template";

// ---------------------------------------------------------------------------
// renderResultsDigest — pure renderer
// ---------------------------------------------------------------------------

const STRINGS: ResultsDigestStrings = {
  subject: "Your daily World Cup pool recap",
  preheader: "preheader text",
  eyebrow: "Daily results digest",
  heading: "Alex, here's how the pool moved",
  intro: "A quick recap of the leaderboard.",
  top5Label: "Top 5",
  rankLabel: "Rank",
  playerLabel: "Player",
  pointsLabel: "Points",
  yourRankLabel: "Your standing",
  yourPointsLabel: "Points",
  deltaUpLabel: "Up",
  deltaDownLabel: "Down",
  deltaFlatLabel: "No change",
  moversLabel: "Biggest movers",
  climbedLabel: "Climbed",
  droppedLabel: "Dropped",
  youLabel: "You",
  ctaLabel: "View full leaderboard",
  footer: "You're getting this daily recap of your World Cup pool.",
};

function makeData(overrides: Partial<ResultsDigestData> = {}): ResultsDigestData {
  return {
    displayName: "Alex",
    top5: [
      { rank: 1, displayName: "Sam", totalPoints: 42 },
      { rank: 2, displayName: "Jordan", totalPoints: 39 },
      { rank: 3, displayName: "Alex", totalPoints: 37 },
    ],
    personal: { rank: 3, totalPoints: 37, delta: -2 },
    movers: [
      { displayName: "Sam", rank: 1, delta: -4 },
      { displayName: "Pat", rank: 9, delta: 5 },
    ],
    strings: STRINGS,
    leaderboardUrl: "https://example.com/en/leaderboard",
    ...overrides,
  };
}

describe("renderResultsDigest", () => {
  it("returns subject/html/text without DB or network", () => {
    const out = renderResultsDigest(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("<!DOCTYPE html>");
    expect(typeof out.text).toBe("string");
  });

  it("renders the top 5, the recipient's own rank, movers, and the leaderboard link", () => {
    const out = renderResultsDigest(makeData());
    // Top 5 names + points.
    expect(out.html).toContain("Sam");
    expect(out.html).toContain("Jordan");
    expect(out.html).toContain("42");
    // Personal standing.
    expect(out.html).toContain("37"); // own points
    expect(out.html).toContain(STRINGS.youLabel);
    // Movers.
    expect(out.html).toContain(STRINGS.moversLabel);
    expect(out.html).toContain("Pat");
    // CTA link.
    expect(out.html).toContain("https://example.com/en/leaderboard");
    // Text part mirrors content.
    expect(out.text).toContain("Sam");
    expect(out.text).toContain("https://example.com/en/leaderboard");
  });

  it("omits the rank delta when personal.delta is null", () => {
    const out = renderResultsDigest(
      makeData({ personal: { rank: 3, totalPoints: 37, delta: null } }),
    );
    // The flat/up/down labels should not appear in the personal block when no
    // baseline; with movers also null neither should show.
    const noMovers = renderResultsDigest(
      makeData({ personal: { rank: 3, totalPoints: 37, delta: null }, movers: null }),
    );
    expect(noMovers.html).not.toContain(STRINGS.deltaUpLabel);
    expect(noMovers.html).not.toContain(STRINGS.deltaDownLabel);
    // top 5 + own rank still render.
    expect(out.html).toContain("Top 5");
    expect(out.html).toContain("37");
  });

  it("omits the movers section when movers is null", () => {
    const out = renderResultsDigest(makeData({ movers: null }));
    expect(out.html).not.toContain(STRINGS.moversLabel);
    expect(out.text).not.toContain(STRINGS.moversLabel.toUpperCase());
  });

  it("uses email-safe styling — no oklch, CSS variables, or stylesheets", () => {
    const out = renderResultsDigest(makeData());
    expect(out.html).not.toMatch(/oklch/i);
    expect(out.html).not.toContain("var(--");
    expect(out.html).not.toContain("<link");
    expect(out.html).not.toContain("class=");
  });

  it("escapes HTML in names to prevent injection", () => {
    const out = renderResultsDigest(makeData({ displayName: "<script>alert(1)</script>" }));
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("falls back to an em dash when the recipient's rank is null", () => {
    const out = renderResultsDigest(
      makeData({ personal: { rank: null, totalPoints: 0, delta: null } }),
    );
    expect(out.html).toContain("—");
  });
});
