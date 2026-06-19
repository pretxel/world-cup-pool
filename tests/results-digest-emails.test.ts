import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Pure helpers: computeDeltas / computeMovers / computePendingRecipients
// ---------------------------------------------------------------------------

import {
  computeDeltas,
  computeMovers,
  computePendingRecipients,
  buildResultsDigestStrings,
  type BoardRow,
} from "@/lib/notifications/results-digest-emails";

function board(rows: Partial<BoardRow>[]): BoardRow[] {
  return rows.map((r, i) => ({
    user_id: r.user_id ?? `u${i}`,
    rank: r.rank ?? i + 1,
    total_points: r.total_points ?? 0,
    display_name: r.display_name ?? `Player ${i}`,
  }));
}

describe("computeDeltas", () => {
  it("computes today.rank - prior.rank, negative when the player climbed", () => {
    const b = board([
      { user_id: "u1", rank: 1 },
      { user_id: "u2", rank: 5 },
    ]);
    const deltas = computeDeltas(b, [
      { user_id: "u1", rank: 3 }, // was 3rd, now 1st → climbed (-2)
      { user_id: "u2", rank: 2 }, // was 2nd, now 5th → dropped (+3)
    ]);
    expect(deltas.get("u1")).toBe(-2);
    expect(deltas.get("u2")).toBe(3);
  });

  it("omits users with no prior snapshot row", () => {
    const b = board([{ user_id: "u1", rank: 1 }]);
    const deltas = computeDeltas(b, []);
    expect(deltas.has("u1")).toBe(false);
  });
});

describe("computeMovers", () => {
  it("returns the biggest absolute movers, sorted by magnitude, excluding zeros", () => {
    const b = board([
      { user_id: "u1", rank: 1 },
      { user_id: "u2", rank: 2 },
      { user_id: "u3", rank: 3 },
    ]);
    const deltas = new Map([
      ["u1", -1],
      ["u2", 6],
      ["u3", 0], // no change → excluded
    ]);
    const movers = computeMovers(b, deltas, 5);
    expect(movers.map((m) => m.delta)).toEqual([6, -1]);
  });

  it("caps the list at the limit", () => {
    const b = board([{}, {}, {}]);
    const deltas = new Map([
      ["u0", -3],
      ["u1", 4],
      ["u2", -5],
    ]);
    expect(computeMovers(b, deltas, 2)).toHaveLength(2);
  });
});

describe("computePendingRecipients", () => {
  it("drops already-sent and opted-out users; keeps absent/opted-in", () => {
    const b = board([
      { user_id: "u1" },
      { user_id: "u2" },
      { user_id: "u3" },
      { user_id: "u4" },
    ]);
    const pending = computePendingRecipients(
      b,
      [{ user_id: "u1" }], // already sent today
      [
        { user_id: "u2", email_prefs: { results_digest: false } }, // opted out
        { user_id: "u3", email_prefs: {} }, // missing key → opted in
        // u4 has no pref row → opted in
      ],
    );
    expect(pending.map((p) => p.user_id)).toEqual(["u3", "u4"]);
  });
});

describe("buildResultsDigestStrings", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  it("uses the named heading when a display name is present", () => {
    const s = buildResultsDigestStrings(t, { displayName: "Alex" });
    expect(s.heading).toBe('heading:{"name":"Alex"}');
    expect(s.subject).toBe("subject");
  });

  it("uses the no-name heading when displayName is null", () => {
    const s = buildResultsDigestStrings(t, { displayName: null });
    expect(s.heading).toBe("headingNoName");
  });
});

// ---------------------------------------------------------------------------
// dispatchResultsDigest — gating + dedupe + opt-out + delta wiring
// ---------------------------------------------------------------------------

const batchSendMock = vi.fn();
const ledgerUpsertMock = vi.fn();
const snapshotUpsertMock = vi.fn();
const getUserByIdMock = vi.fn();

let boardData: unknown[] = [];
let priorSnapshotData: unknown[] = [];
let sentTodayData: unknown[] = [];
let prefsData: unknown[] = [];
let resendApiKey: string | null = "re_test";

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
      if (table === "v_leaderboard_overall") {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: boardData, error: null }),
          }),
        };
      }
      if (table === "leaderboard_rank_daily") {
        return {
          upsert: snapshotUpsertMock,
          select: () => ({
            lt: () => ({
              order: () => Promise.resolve({ data: priorSnapshotData, error: null }),
            }),
          }),
        };
      }
      if (table === "results_digest_log") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: sentTodayData, error: null }),
          }),
          upsert: ledgerUpsertMock,
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: prefsData, error: null }),
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
  ledgerUpsertMock.mockReset().mockResolvedValue({ error: null });
  snapshotUpsertMock.mockReset().mockResolvedValue({ error: null });
  getUserByIdMock
    .mockReset()
    .mockResolvedValue({ data: { user: { email: "player@wc26pool.com" } }, error: null });
  boardData = [
    { user_id: "u1", rank: 1, total_points: 20, display_name: "Alex" },
    { user_id: "u2", rank: 2, total_points: 18, display_name: "Sam" },
  ];
  priorSnapshotData = [];
  sentTodayData = [];
  prefsData = [];
  resendApiKey = "re_test";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("dispatchResultsDigest", () => {
  it("no-ops without throwing when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { dispatchResultsDigest } = await import("@/lib/notifications/results-digest-emails");
    const summary = await dispatchResultsDigest();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("emails active players and stamps the per-day ledger only after Resend accepts", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchResultsDigest } = await import("@/lib/notifications/results-digest-emails");
    const summary = await dispatchResultsDigest();
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

  it("leaves a failed batch pending (no ledger write, counted as failed)", async () => {
    batchSendMock.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const { dispatchResultsDigest } = await import("@/lib/notifications/results-digest-emails");
    const summary = await dispatchResultsDigest();
    expect(summary.failed).toBe(2);
    expect(summary.emailed).toBe(0);
    expect(ledgerUpsertMock).not.toHaveBeenCalled();
  });

  it("does not re-send to a recipient already in today's ledger", async () => {
    sentTodayData = [{ user_id: "u1" }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchResultsDigest } = await import("@/lib/notifications/results-digest-emails");
    const summary = await dispatchResultsDigest();
    expect(summary.emailed).toBe(1);
    expect(ledgerUpsertMock).toHaveBeenCalledWith(
      [expect.objectContaining({ user_id: "u2" })],
      expect.anything(),
    );
  });

  it("drops a recipient who opted out of results_digest", async () => {
    prefsData = [{ id: "u1", email_prefs: { results_digest: false } }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchResultsDigest } = await import("@/lib/notifications/results-digest-emails");
    const summary = await dispatchResultsDigest();
    expect(summary.emailed).toBe(1);
  });

  it("keeps a recipient with no explicit results_digest preference", async () => {
    prefsData = [{ id: "u1", email_prefs: {} }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchResultsDigest } = await import("@/lib/notifications/results-digest-emails");
    const summary = await dispatchResultsDigest();
    expect(summary.emailed).toBe(2);
  });

  it("upserts today's snapshot and computes deltas from a prior snapshot", async () => {
    // u1 was 3rd yesterday, now 1st → climbed (-2); u2 had no prior row.
    priorSnapshotData = [{ user_id: "u1", rank: 3, snapshot_date: "2026-06-18" }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchResultsDigest } = await import("@/lib/notifications/results-digest-emails");
    const summary = await dispatchResultsDigest();
    expect(summary.emailed).toBe(2);
    // Snapshot upsert includes today's ranks for both players.
    expect(snapshotUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "u1", rank: 1 }),
        expect.objectContaining({ user_id: "u2", rank: 2 }),
      ]),
      expect.objectContaining({ onConflict: "snapshot_date,user_id" }),
    );
  });

  it("counts an unresolvable email as skipped, not failed", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchResultsDigest } = await import("@/lib/notifications/results-digest-emails");
    const summary = await dispatchResultsDigest();
    expect(summary.skipped).toBe(2);
    expect(summary.emailed).toBe(0);
    expect(batchSendMock).not.toHaveBeenCalled();
  });
});
