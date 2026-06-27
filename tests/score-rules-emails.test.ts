import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Pure helpers: buildScoreRulesPhases / computePendingRecipients /
// buildScoreRulesStrings
// ---------------------------------------------------------------------------

import {
  buildScoreRulesPhases,
  computePendingRecipients,
  buildScoreRulesStrings,
} from "@/lib/notifications/score-rules-emails";

describe("buildScoreRulesPhases", () => {
  it("derives points from the shared constants (base × multiplier)", () => {
    const rows = buildScoreRulesPhases(null, "en");
    const group = rows.find((r) => r.stageLabel === "group")!;
    const final = rows.find((r) => r.stageLabel === "final")!;
    expect(group).toMatchObject({ multiplier: 1, exact: 5, winnerGd: 3, winner: 1 });
    expect(final).toMatchObject({ multiplier: 10, exact: 50, winnerGd: 30, winner: 10 });
  });

  it("covers every phase in ascending-stakes order", () => {
    const rows = buildScoreRulesPhases(null, "en");
    expect(rows.map((r) => r.stageLabel)).toEqual([
      "group",
      "r32",
      "r16",
      "qf",
      "sf",
      "final",
      "third",
    ]);
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

describe("buildScoreRulesStrings", () => {
  it("maps every copy key through the translator", () => {
    const s = buildScoreRulesStrings((k) => k);
    expect(s.subject).toBe("subject");
    expect(s.exactHeader).toBe("exactHeader");
    expect(s.footer).toBe("footer");
  });
});

// ---------------------------------------------------------------------------
// dispatchScoreRulesEmail — recipients + send-once ledger + batching
// ---------------------------------------------------------------------------

const batchSendMock = vi.fn();
const ledgerUpsertMock = vi.fn();
const getUserByIdMock = vi.fn();

let competitionData: unknown = null;
let profilesData: unknown[] = [];
let sentData: unknown[] = [];
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
      if (table === "profiles") {
        return {
          select: () => ({
            order: () => ({ range: () => Promise.resolve({ data: profilesData, error: null }) }),
          }),
        };
      }
      if (table === "score_rules_email_log") {
        return {
          select: () => Promise.resolve({ data: sentData, error: null }),
          upsert: ledgerUpsertMock,
        };
      }
      throw new Error(`unexpected from(${table})`);
    },
    auth: { admin: { getUserById: getUserByIdMock } },
  })),
}));

beforeEach(() => {
  batchSendMock.mockReset();
  ledgerUpsertMock.mockReset().mockResolvedValue({ error: null });
  getUserByIdMock
    .mockReset()
    .mockResolvedValue({ data: { user: { email: "player@wc26pool.com" } }, error: null });
  competitionData = null; // null format → stage-key labels, no parse needed
  profilesData = [
    { id: "u1", email_prefs: {} },
    { id: "u2", email_prefs: {} },
  ];
  sentData = [];
  resendApiKey = "re_test";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("dispatchScoreRulesEmail", () => {
  it("no-ops without throwing when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { dispatchScoreRulesEmail } = await import("@/lib/notifications/score-rules-emails");
    const summary = await dispatchScoreRulesEmail();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("emails all opted-in players and stamps the ledger by user only after Resend accepts", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchScoreRulesEmail } = await import("@/lib/notifications/score-rules-emails");
    const summary = await dispatchScoreRulesEmail();
    expect(summary.emailed).toBe(2);
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(ledgerUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "u1" }),
        expect.objectContaining({ user_id: "u2" }),
      ]),
      expect.objectContaining({ onConflict: "user_id", ignoreDuplicates: true }),
    );
  });

  it("no-ops when every eligible player is already in the ledger", async () => {
    sentData = [{ user_id: "u1" }, { user_id: "u2" }];
    const { dispatchScoreRulesEmail } = await import("@/lib/notifications/score-rules-emails");
    const summary = await dispatchScoreRulesEmail();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("does not re-send to a recipient already in the ledger", async () => {
    sentData = [{ user_id: "u1" }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchScoreRulesEmail } = await import("@/lib/notifications/score-rules-emails");
    const summary = await dispatchScoreRulesEmail();
    expect(summary.emailed).toBe(1);
    expect(ledgerUpsertMock).toHaveBeenCalledWith(
      [expect.objectContaining({ user_id: "u2" })],
      expect.anything(),
    );
  });

  it("leaves a failed batch pending (no ledger write, counted as failed)", async () => {
    batchSendMock.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const { dispatchScoreRulesEmail } = await import("@/lib/notifications/score-rules-emails");
    const summary = await dispatchScoreRulesEmail();
    expect(summary.failed).toBe(2);
    expect(summary.emailed).toBe(0);
    expect(ledgerUpsertMock).not.toHaveBeenCalled();
  });

  it("drops a recipient who opted out of the results-digest family", async () => {
    profilesData = [
      { id: "u1", email_prefs: { results_digest: false } },
      { id: "u2", email_prefs: {} },
    ];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchScoreRulesEmail } = await import("@/lib/notifications/score-rules-emails");
    const summary = await dispatchScoreRulesEmail();
    expect(summary.emailed).toBe(1);
  });

  it("counts an unresolvable email as skipped, not failed", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
    const { dispatchScoreRulesEmail } = await import("@/lib/notifications/score-rules-emails");
    const summary = await dispatchScoreRulesEmail();
    expect(summary.skipped).toBe(2);
    expect(summary.emailed).toBe(0);
    expect(batchSendMock).not.toHaveBeenCalled();
  });
});
