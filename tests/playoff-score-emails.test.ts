import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Pure helpers: isSaturdayUtc / utcDayWindow / selectFinishedPlayoffMatches /
// computePendingRecipients
// ---------------------------------------------------------------------------

import {
  isSaturdayUtc,
  utcDayWindow,
  selectFinishedPlayoffMatches,
  computePendingRecipients,
  type RawMatchRow,
} from "@/lib/notifications/playoff-score-emails";

describe("isSaturdayUtc", () => {
  it("is true on a Saturday and false otherwise (UTC)", () => {
    expect(isSaturdayUtc(new Date("2026-06-27T12:00:00Z"))).toBe(true); // Saturday
    expect(isSaturdayUtc(new Date("2026-06-26T12:00:00Z"))).toBe(false); // Friday
    expect(isSaturdayUtc(new Date("2026-06-28T12:00:00Z"))).toBe(false); // Sunday
  });
});

describe("utcDayWindow", () => {
  it("returns a 24h [start, end) epoch window for the UTC day", () => {
    const { startMs, endMs } = utcDayWindow("2026-06-27");
    expect(startMs).toBe(Date.parse("2026-06-27T00:00:00.000Z"));
    expect(endMs).toBe(Date.parse("2026-06-28T00:00:00.000Z"));
  });
});

function rawMatch(overrides: Partial<RawMatchRow> = {}): RawMatchRow {
  return {
    home_team: "Brazil",
    away_team: "Spain",
    home_score: 2,
    away_score: 1,
    stage: "r16",
    status: "final",
    kickoff_at: "2026-06-27T16:00:00.000Z",
    ...overrides,
  };
}

describe("selectFinishedPlayoffMatches", () => {
  const window = utcDayWindow("2026-06-27");

  it("keeps final non-group matches kicked off within the window", () => {
    const out = selectFinishedPlayoffMatches([rawMatch(), rawMatch({ stage: "qf" })], window);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ home: "Brazil", away: "Spain", homeScore: 2, awayScore: 1 });
  });

  it("excludes group-stage matches", () => {
    const out = selectFinishedPlayoffMatches([rawMatch({ stage: "group" })], window);
    expect(out).toHaveLength(0);
  });

  it("excludes non-final matches", () => {
    const out = selectFinishedPlayoffMatches(
      [rawMatch({ status: "live" }), rawMatch({ status: "scheduled" })],
      window,
    );
    expect(out).toHaveLength(0);
  });

  it("excludes matches outside the day window (timezone boundary)", () => {
    const out = selectFinishedPlayoffMatches(
      [
        rawMatch({ kickoff_at: "2026-06-26T23:59:59.000Z" }), // day before
        rawMatch({ kickoff_at: "2026-06-28T00:00:00.000Z" }), // exactly next day start (exclusive)
        rawMatch({ kickoff_at: "2026-06-27T00:00:00.000Z" }), // inclusive start — kept
      ],
      window,
    );
    expect(out).toHaveLength(1);
  });
});

describe("computePendingRecipients", () => {
  it("drops already-sent and opted-out users; keeps absent/opted-in", () => {
    const profiles = [
      { user_id: "u1", email_prefs: {} },
      { user_id: "u2", email_prefs: { results_digest: false } }, // opted out
      { user_id: "u3", email_prefs: { results_digest: true } },
      { user_id: "u4", email_prefs: null }, // malformed → opted in
    ];
    const pending = computePendingRecipients(profiles, [{ user_id: "u1" }]);
    expect(pending.map((p) => p.user_id)).toEqual(["u3", "u4"]);
  });
});

// ---------------------------------------------------------------------------
// dispatchPlayoffScoreEmail — selection + recipients + dedupe + batching
// ---------------------------------------------------------------------------

const batchSendMock = vi.fn();
const ledgerUpsertMock = vi.fn();
const getUserByIdMock = vi.fn();

let competitionData: unknown = { id: "comp-1" };
let matchesData: unknown[] = [];
let profilesData: unknown[] = [];
let sentTodayData: unknown[] = [];
let resendApiKey: string | null = "re_test";

vi.mock("@/lib/env", () => ({
  env: {
    get resendApiKey() {
      return resendApiKey;
    },
    emailFrom: "World Cup Pools <test@example.com>",
    emailReplyTo: "test@example.com",
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
      if (table === "competitions") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: competitionData, error: null }) }),
          }),
        };
      }
      if (table === "matches") {
        return {
          select: () => ({
            eq: () => ({ eq: () => Promise.resolve({ data: matchesData, error: null }) }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            order: () => ({ range: () => Promise.resolve({ data: profilesData, error: null }) }),
          }),
        };
      }
      if (table === "playoff_score_email_log") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: sentTodayData, error: null }),
          }),
          upsert: ledgerUpsertMock,
        };
      }
      throw new Error(`unexpected from(${table})`);
    },
    auth: { admin: { getUserById: getUserByIdMock } },
  })),
}));

// A final knockout match in today's UTC window so the dispatcher selects it.
function todayPlayoffMatch() {
  const day = new Date().toISOString().slice(0, 10);
  return {
    home_team: "Brazil",
    away_team: "Spain",
    home_score: 2,
    away_score: 1,
    stage: "r16",
    status: "final",
    kickoff_at: `${day}T12:00:00.000Z`,
  };
}

beforeEach(() => {
  batchSendMock.mockReset();
  ledgerUpsertMock.mockReset().mockResolvedValue({ error: null });
  getUserByIdMock
    .mockReset()
    .mockResolvedValue({ data: { user: { email: "player@wc26pool.com" } }, error: null });
  competitionData = { id: "comp-1" };
  matchesData = [todayPlayoffMatch()];
  profilesData = [
    { id: "u1", email_prefs: {} },
    { id: "u2", email_prefs: {} },
  ];
  sentTodayData = [];
  resendApiKey = "re_test";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("dispatchPlayoffScoreEmail", () => {
  it("no-ops without throwing when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { dispatchPlayoffScoreEmail } = await import("@/lib/notifications/playoff-score-emails");
    const summary = await dispatchPlayoffScoreEmail();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("emails all opted-in players (including non-predictors) and stamps the ledger only after Resend accepts", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPlayoffScoreEmail } = await import("@/lib/notifications/playoff-score-emails");
    const summary = await dispatchPlayoffScoreEmail();
    expect(summary.emailed).toBe(2);
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(ledgerUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "u1" }),
        expect.objectContaining({ user_id: "u2" }),
      ]),
      expect.objectContaining({ onConflict: "digest_date,user_id", ignoreDuplicates: true }),
    );
  });

  it("sends nothing when there are no finished playoff matches today", async () => {
    matchesData = [];
    const { dispatchPlayoffScoreEmail } = await import("@/lib/notifications/playoff-score-emails");
    const summary = await dispatchPlayoffScoreEmail();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
    expect(ledgerUpsertMock).not.toHaveBeenCalled();
  });

  it("sends nothing when only group-stage finals exist today", async () => {
    matchesData = [{ ...todayPlayoffMatch(), stage: "group" }];
    const { dispatchPlayoffScoreEmail } = await import("@/lib/notifications/playoff-score-emails");
    const summary = await dispatchPlayoffScoreEmail();
    expect(summary.emailed).toBe(0);
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("leaves a failed batch pending (no ledger write, counted as failed)", async () => {
    batchSendMock.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const { dispatchPlayoffScoreEmail } = await import("@/lib/notifications/playoff-score-emails");
    const summary = await dispatchPlayoffScoreEmail();
    expect(summary.failed).toBe(2);
    expect(summary.emailed).toBe(0);
    expect(ledgerUpsertMock).not.toHaveBeenCalled();
  });

  it("does not re-send to a recipient already in today's ledger", async () => {
    sentTodayData = [{ user_id: "u1" }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPlayoffScoreEmail } = await import("@/lib/notifications/playoff-score-emails");
    const summary = await dispatchPlayoffScoreEmail();
    expect(summary.emailed).toBe(1);
    expect(ledgerUpsertMock).toHaveBeenCalledWith(
      [expect.objectContaining({ user_id: "u2" })],
      expect.anything(),
    );
  });

  it("drops a recipient who opted out of the results-digest family", async () => {
    profilesData = [
      { id: "u1", email_prefs: { results_digest: false } },
      { id: "u2", email_prefs: {} },
    ];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPlayoffScoreEmail } = await import("@/lib/notifications/playoff-score-emails");
    const summary = await dispatchPlayoffScoreEmail();
    expect(summary.emailed).toBe(1);
  });

  it("counts an unresolvable email as skipped, not failed", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPlayoffScoreEmail } = await import("@/lib/notifications/playoff-score-emails");
    const summary = await dispatchPlayoffScoreEmail();
    expect(summary.skipped).toBe(2);
    expect(summary.emailed).toBe(0);
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("sends nothing when no competition is active", async () => {
    competitionData = null;
    const { dispatchPlayoffScoreEmail } = await import("@/lib/notifications/playoff-score-emails");
    const summary = await dispatchPlayoffScoreEmail();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });
});
