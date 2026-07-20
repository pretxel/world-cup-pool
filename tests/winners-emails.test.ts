import { describe, expect, it } from "vitest";
import {
  renderWinnersEmail,
  type WinnersEmailData,
  type WinnersEmailStrings,
} from "@/lib/notifications/winners-email-template";
import {
  computePendingWinners,
  buildWinnersEmailStrings,
  type WinnerRow,
} from "@/lib/notifications/winners-emails";

// ---------------------------------------------------------------------------
// renderWinnersEmail — pure renderer
// ---------------------------------------------------------------------------

const STRINGS: WinnersEmailStrings = {
  subject: "You finished 2nd in the pool! 🥈",
  preheader: "Final standings are in — you're on the podium with 58 points.",
  eyebrow: "Final whistle",
  heading: "Ana, you took second place!",
  intro: "You finished #2 with 58 points.",
  podiumLabel: "Final podium",
  rankLabel: "Rank",
  playerLabel: "Player",
  pointsLabel: "pts",
  youLabel: "You",
  ctaLabel: "See the final leaderboard",
  footer: "You're getting this because you finished on the podium.",
  madeWithLove: "Made with love :) — pretxel",
  comingSoon: "Coming soon: La Liga Pool",
};

function makeData(overrides: Partial<WinnersEmailData> = {}): WinnersEmailData {
  return {
    displayName: "Ana",
    rank: 2,
    totalPoints: 58,
    podium: [
      { rank: 1, displayName: "Lupita", totalPoints: 61, isYou: false },
      { rank: 2, displayName: "Ana", totalPoints: 58, isYou: true },
      { rank: 3, displayName: "Karim", totalPoints: 55, isYou: false },
    ],
    leaderboardUrl: "https://example.com/en/leaderboard",
    strings: STRINGS,
    ...overrides,
  };
}

describe("renderWinnersEmail", () => {
  it("returns subject/html/text without DB or network", () => {
    const out = renderWinnersEmail(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("<!DOCTYPE html>");
    expect(typeof out.text).toBe("string");
  });

  it("renders the full podium and marks only the recipient's row", () => {
    const out = renderWinnersEmail(makeData());
    for (const part of [out.html, out.text]) {
      expect(part).toContain("Lupita");
      expect(part).toContain("Ana");
      expect(part).toContain("Karim");
    }
    // Exactly one you-chip in the HTML podium.
    expect(out.html.split(`>${STRINGS.youLabel}</span>`).length - 1).toBe(1);
    expect(out.text).toContain(`Ana (${STRINGS.youLabel})`);
    expect(out.text).not.toContain(`Lupita (${STRINGS.youLabel})`);
  });

  it("carries the credit and La Liga teaser in both bodies", () => {
    const out = renderWinnersEmail(makeData());
    for (const part of [out.html, out.text]) {
      expect(part).toContain("pretxel");
      expect(part).toContain("La Liga Pool");
    }
  });

  it("escapes HTML in player names", () => {
    const out = renderWinnersEmail(
      makeData({
        podium: [
          { rank: 1, displayName: "<img src=x>", totalPoints: 61, isYou: false },
          { rank: 2, displayName: "Ana", totalPoints: 58, isYou: true },
        ],
      }),
    );
    expect(out.html).not.toContain("<img src=x>");
    expect(out.html).toContain("&lt;img src=x&gt;");
  });
});

// ---------------------------------------------------------------------------
// computePendingWinners — ledger + preference gating
// ---------------------------------------------------------------------------

function winner(id: string, rank: number): WinnerRow {
  return { user_id: id, display_name: id, rank, total_points: 50 };
}

describe("computePendingWinners", () => {
  const podium = [winner("a", 1), winner("b", 2), winner("c", 3)];

  it("keeps everyone when no ledger rows and no opt-outs", () => {
    const pending = computePendingWinners(podium, new Map(), []);
    expect(pending.map((w) => w.user_id)).toEqual(["a", "b", "c"]);
  });

  it("drops winners already in the send-once ledger", () => {
    const pending = computePendingWinners(podium, new Map(), [{ user_id: "b" }]);
    expect(pending.map((w) => w.user_id)).toEqual(["a", "c"]);
  });

  it("drops winners opted out of the results_digest preference", () => {
    const prefs = new Map<string, unknown>([["c", { results_digest: false }]]);
    const pending = computePendingWinners(podium, prefs, []);
    expect(pending.map((w) => w.user_id)).toEqual(["a", "b"]);
  });

  it("treats absent or malformed prefs as opted-in", () => {
    const prefs = new Map<string, unknown>([["a", "garbage"]]);
    const pending = computePendingWinners(podium, prefs, []);
    expect(pending.map((w) => w.user_id)).toEqual(["a", "b", "c"]);
  });

  it("is idempotent: a fully-ledgered podium yields nothing", () => {
    const pending = computePendingWinners(
      podium,
      new Map(),
      podium.map((w) => ({ user_id: w.user_id })),
    );
    expect(pending).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildWinnersEmailStrings — rank select + interpolation
// ---------------------------------------------------------------------------

describe("buildWinnersEmailStrings", () => {
  // Key-echo translator that records values, mirroring existing email tests.
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const t = (key: string, values?: Record<string, unknown>) => {
    calls.push([key, values]);
    return key;
  };

  it("passes rank as a string for ICU select and interpolates the name", () => {
    calls.length = 0;
    buildWinnersEmailStrings(t, { displayName: "Ana", rank: 1, totalPoints: 61 });
    const subject = calls.find(([k]) => k === "subject");
    expect(subject?.[1]).toMatchObject({ rank: "1", points: 61 });
    const heading = calls.find(([k]) => k === "heading");
    expect(heading?.[1]).toMatchObject({ name: "Ana", rank: "1" });
  });

  it("falls back to headingNoName without a display name", () => {
    calls.length = 0;
    const strings = buildWinnersEmailStrings(t, {
      displayName: null,
      rank: 3,
      totalPoints: 40,
    });
    expect(strings.heading).toBe("headingNoName");
  });
});
