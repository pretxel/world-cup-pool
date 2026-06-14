import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderResultEmail,
  type ResultEmailData,
  type ResultEmailStrings,
} from "@/lib/notifications/result-email-template";

// ---------------------------------------------------------------------------
// renderResultEmail — pure renderer (task 6.1)
// ---------------------------------------------------------------------------

const STRINGS: ResultEmailStrings = {
  subject: "+5 pts in your World Cup pool",
  preheader: "preheader text",
  eyebrow: "Match results in",
  heading: "Alex, your standing just changed",
  intro: "Here's how the latest results moved your pool standing.",
  resultsLabel: "What just finished",
  standingLabel: "Your standing",
  rankLabel: "Rank",
  playerLabel: "Player",
  pointsLabel: "Points",
  exactLabel: "Exact",
  winnerGdLabel: "Winner/GD",
  youLabel: "You",
  ptsSuffix: "pts",
  outcomes: {
    exact: "Exact",
    winner_gd: "Winner + GD",
    winner: "Winner",
    miss: "Miss",
  },
  ctaLabel: "View full leaderboard",
  footer: "You're getting this because a match you predicted just finished.",
};

function makeData(overrides: Partial<ResultEmailData> = {}): ResultEmailData {
  return {
    displayName: "Alex",
    standing: { rank: 4, totalPoints: 18, exactHits: 2, winnerGdHits: 1 },
    matches: [
      {
        homeTeam: "Mexico",
        awayTeam: "South Africa",
        homeScore: 2,
        awayScore: 1,
        points: 5,
        hitType: "exact",
      },
    ],
    strings: STRINGS,
    leaderboardUrl: "https://example.com/en/leaderboard",
    ...overrides,
  };
}

describe("renderResultEmail", () => {
  it("returns subject/html/text without DB or network", () => {
    const out = renderResultEmail(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("<!DOCTYPE html>");
    expect(typeof out.text).toBe("string");
  });

  it("renders the finished match scoreline and snapshot values", () => {
    const out = renderResultEmail(makeData());
    expect(out.html).toContain("Mexico");
    expect(out.html).toContain("South Africa");
    expect(out.html).toContain("2");
    expect(out.html).toContain("1");
    // Standing snapshot.
    expect(out.html).toContain("18"); // total points
    expect(out.html).toContain("Alex");
    expect(out.html).toContain(STRINGS.youLabel);
  });

  it("uses email-safe styling — no oklch, CSS variables, or stylesheets", () => {
    const out = renderResultEmail(makeData());
    expect(out.html).not.toMatch(/oklch/i);
    expect(out.html).not.toContain("var(--");
    expect(out.html).not.toContain("<link");
    expect(out.html).not.toContain("class=");
  });

  it("colors the outcome chip per hit type (exact = gold, winner/GD = green)", () => {
    const exact = renderResultEmail(makeData());
    expect(exact.html).toContain("#E7B53C"); // flag gold for exact

    const wgd = renderResultEmail(
      makeData({
        matches: [
          {
            homeTeam: "Brazil",
            awayTeam: "Spain",
            homeScore: 1,
            awayScore: 0,
            points: 3,
            hitType: "winner_gd",
          },
        ],
      }),
    );
    expect(wgd.html).toContain("#1B7A4D"); // pitch green for winner/GD
    expect(wgd.html).toContain("Winner + GD");
  });

  it("lists multiple finished matches in a single email", () => {
    const out = renderResultEmail(
      makeData({
        matches: [
          {
            homeTeam: "Mexico",
            awayTeam: "South Africa",
            homeScore: 2,
            awayScore: 1,
            points: 5,
            hitType: "exact",
          },
          {
            homeTeam: "Brazil",
            awayTeam: "Spain",
            homeScore: 0,
            awayScore: 0,
            points: 1,
            hitType: "winner",
          },
        ],
      }),
    );
    expect(out.html).toContain("Mexico");
    expect(out.html).toContain("Brazil");
    expect(out.text).toContain("Mexico");
    expect(out.text).toContain("Brazil");
  });

  it("escapes HTML in names to prevent injection", () => {
    const out = renderResultEmail(makeData({ displayName: "<script>alert(1)</script>" }));
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("falls back to an em dash when rank is null", () => {
    const out = renderResultEmail(
      makeData({
        standing: { rank: null, totalPoints: 0, exactHits: 0, winnerGdHits: 0 },
      }),
    );
    expect(out.html).toContain("—");
  });
});

// ---------------------------------------------------------------------------
// computePendingByUser + buildResultEmailStrings — pure logic (task 6.2)
// ---------------------------------------------------------------------------

import {
  buildResultEmailStrings,
  computePendingByUser,
  type ScoredFinalRow,
} from "@/lib/notifications/result-emails";

function scoredRow(over: Partial<ScoredFinalRow> = {}): ScoredFinalRow {
  return {
    user_id: "u1",
    match_id: "m1",
    points: 5,
    hit_type: "exact",
    home_team: "Mexico",
    away_team: "South Africa",
    home_score: 2,
    away_score: 1,
    ...over,
  };
}

describe("computePendingByUser", () => {
  it("treats scored-final rows with no ledger entry as pending", () => {
    const pending = computePendingByUser([scoredRow()], []);
    expect(pending).toHaveLength(1);
    expect(pending[0].userId).toBe("u1");
    expect(pending[0].matchIds).toEqual(["m1"]);
    expect(pending[0].matches[0].hitType).toBe("exact");
  });

  it("skips pairs already in the ledger", () => {
    const pending = computePendingByUser(
      [scoredRow({ user_id: "u1", match_id: "m1" })],
      [{ match_id: "m1", user_id: "u1" }],
    );
    expect(pending).toHaveLength(0);
  });

  it("groups multiple matches for one user into a single recipient", () => {
    const pending = computePendingByUser(
      [
        scoredRow({ match_id: "m1" }),
        scoredRow({ match_id: "m2", points: 3, hit_type: "winner_gd" }),
      ],
      [],
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].matchIds.sort()).toEqual(["m1", "m2"]);
    expect(pending[0].matches).toHaveLength(2);
  });

  it("only the unsent pairs survive a partial ledger", () => {
    const pending = computePendingByUser(
      [scoredRow({ user_id: "u1", match_id: "m1" }), scoredRow({ user_id: "u2", match_id: "m1" })],
      [{ match_id: "m1", user_id: "u1" }],
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].userId).toBe("u2");
  });
});

describe("buildResultEmailStrings", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  it("interpolates the earned points into the subject", () => {
    const s = buildResultEmailStrings(t, {
      displayName: "Alex",
      earnedPoints: 8,
    });
    expect(s.subject).toBe('subject:{"points":8}');
    expect(s.heading).toBe('heading:{"name":"Alex"}');
  });

  it("uses the no-name heading when displayName is null", () => {
    const s = buildResultEmailStrings(t, {
      displayName: null,
      earnedPoints: 0,
    });
    expect(s.heading).toBe("headingNoName");
  });
});

// ---------------------------------------------------------------------------
// dispatchResultEmails — gating + ledger/failure behavior (task 6.3)
// ---------------------------------------------------------------------------

const batchSendMock = vi.fn();
const upsertMock = vi.fn();
const getUserByIdMock = vi.fn();
let scoredData: unknown[] = [];
let ledgerData: unknown[] = [];
let boardData: unknown[] = [];
let resendApiKey: string | null = "re_test";
// Records the column/value of every `.eq()` applied to the scores query so
// tests can assert the force path scopes by match_id at the data layer.
let scoredEqCalls: { col: string; val: unknown }[] = [];

vi.mock("@/lib/env", () => ({
  env: {
    get resendApiKey() {
      return resendApiKey;
    },
    emailFrom: "World Cup Pools <test@example.com>",
    siteUrl: "https://example.com",
  },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("resend", () => ({
  Resend: class {
    batch = { send: batchSendMock };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "scores") {
        // Chainable + thenable so both `.select().eq()` (cron) and
        // `.select().eq().eq()` (force, scoped by match_id) resolve.
        const chain: {
          select: () => typeof chain;
          eq: (col: string, val: unknown) => typeof chain;
          then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => unknown;
        } = {
          select: () => chain,
          eq: (col: string, val: unknown) => {
            scoredEqCalls.push({ col, val });
            return chain;
          },
          then: (resolve) => resolve({ data: scoredData, error: null }),
        };
        return chain;
      }
      if (table === "result_email_log") {
        return {
          select: () => Promise.resolve({ data: ledgerData, error: null }),
          upsert: upsertMock,
        };
      }
      if (table === "v_leaderboard_overall") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: boardData, error: null }),
          }),
        };
      }
      throw new Error(`unexpected from(${table})`);
    },
    auth: { admin: { getUserById: getUserByIdMock } },
  })),
}));

beforeEach(() => {
  batchSendMock.mockReset();
  upsertMock.mockReset().mockResolvedValue({ error: null });
  getUserByIdMock
    .mockReset()
    .mockResolvedValue({ data: { user: { email: "player@example.com" } }, error: null });
  scoredData = [
    {
      user_id: "u1",
      match_id: "m1",
      points: 5,
      hit_type: "exact",
      matches: {
        home_team: "Mexico",
        away_team: "South Africa",
        home_score: 2,
        away_score: 1,
        status: "final",
      },
    },
  ];
  ledgerData = [];
  scoredEqCalls = [];
  boardData = [
    {
      user_id: "u1",
      rank: 1,
      total_points: 20,
      exact_hits: 3,
      winner_gd_hits: 1,
      display_name: "Alex",
    },
  ];
  resendApiKey = "re_test";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("dispatchResultEmails", () => {
  it("no-ops without throwing when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { dispatchResultEmails } = await import("@/lib/notifications/result-emails");
    const summary = await dispatchResultEmails();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("writes ledger rows only after Resend accepts the batch", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchResultEmails } = await import("@/lib/notifications/result-emails");
    const summary = await dispatchResultEmails();
    expect(summary.emailed).toBe(1);
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      [{ match_id: "m1", user_id: "u1" }],
      expect.objectContaining({ onConflict: "match_id,user_id" }),
    );
  });

  it("leaves a failed send pending (no ledger write, counted as failed)", async () => {
    batchSendMock.mockResolvedValue({
      data: null,
      error: { message: "rate limited" },
    });
    const { dispatchResultEmails } = await import("@/lib/notifications/result-emails");
    const summary = await dispatchResultEmails();
    expect(summary.failed).toBe(1);
    expect(summary.emailed).toBe(0);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("skips recipients whose email cannot be resolved", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchResultEmails } = await import("@/lib/notifications/result-emails");
    const summary = await dispatchResultEmails();
    expect(summary.skipped).toBe(1);
    expect(summary.emailed).toBe(0);
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("does nothing when every scored pair is already in the ledger", async () => {
    ledgerData = [{ match_id: "m1", user_id: "u1" }];
    const { dispatchResultEmails } = await import("@/lib/notifications/result-emails");
    const summary = await dispatchResultEmails();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// forceDispatchResultEmails — admin force path (ledger ignored, match-scoped)
// ---------------------------------------------------------------------------

describe("forceDispatchResultEmails", () => {
  it("re-emails pairs that already have a ledger row (ledger ignored)", async () => {
    // The same pair the cron path would suppress.
    ledgerData = [{ match_id: "m1", user_id: "u1" }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { forceDispatchResultEmails } = await import("@/lib/notifications/result-emails");
    const summary = await forceDispatchResultEmails("m1");
    expect(summary.emailed).toBe(1);
    expect(batchSendMock).toHaveBeenCalledTimes(1);
  });

  it("scopes the scored query to the target match_id at the data layer", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { forceDispatchResultEmails } = await import("@/lib/notifications/result-emails");
    await forceDispatchResultEmails("m1");
    expect(scoredEqCalls).toContainEqual({ col: "match_id", val: "m1" });
    expect(scoredEqCalls).toContainEqual({ col: "matches.status", val: "final" });
  });

  it("re-stamps the ledger so a later cron run does not re-email the pair", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const mod = await import("@/lib/notifications/result-emails");

    // Force send: ledger starts empty for this match, pair is emailed + stamped.
    await mod.forceDispatchResultEmails("m1");
    expect(upsertMock).toHaveBeenCalledWith(
      [{ match_id: "m1", user_id: "u1" }],
      expect.objectContaining({ onConflict: "match_id,user_id", ignoreDuplicates: true }),
    );

    // Simulate the stamp landing, then the cron sees the pair as already sent.
    ledgerData = [{ match_id: "m1", user_id: "u1" }];
    batchSendMock.mockClear();
    const cron = await mod.dispatchResultEmails();
    expect(cron).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("no-ops without throwing when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { forceDispatchResultEmails } = await import("@/lib/notifications/result-emails");
    const summary = await forceDispatchResultEmails("m1");
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("counts an unresolvable email as skipped, not failed", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { forceDispatchResultEmails } = await import("@/lib/notifications/result-emails");
    const summary = await forceDispatchResultEmails("m1");
    expect(summary.skipped).toBe(1);
    expect(summary.emailed).toBe(0);
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("batches force recipients at the ≤100 Resend limit", async () => {
    // 150 scored players on the one match → two batches (100 + 50).
    scoredData = Array.from({ length: 150 }, (_, i) => ({
      user_id: `u${i}`,
      match_id: "m1",
      points: 3,
      hit_type: "winner",
      matches: {
        home_team: "Mexico",
        away_team: "South Africa",
        home_score: 2,
        away_score: 1,
        status: "final",
      },
    }));
    boardData = scoredData.map((r) => ({
      user_id: (r as { user_id: string }).user_id,
      rank: 1,
      total_points: 10,
      exact_hits: 0,
      winner_gd_hits: 0,
      display_name: "Player",
    }));
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { forceDispatchResultEmails } = await import("@/lib/notifications/result-emails");
    const summary = await forceDispatchResultEmails("m1");
    expect(summary.emailed).toBe(150);
    expect(batchSendMock).toHaveBeenCalledTimes(2);
    expect(batchSendMock.mock.calls[0][0]).toHaveLength(100);
    expect(batchSendMock.mock.calls[1][0]).toHaveLength(50);
  });
});
