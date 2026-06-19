import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Pure helpers: computePendingByUser / filterRecapOptIns / buildRecapDigestStrings
// ---------------------------------------------------------------------------

import {
  computePendingByUser,
  filterRecapOptIns,
  buildRecapDigestStrings,
  type RecapImageRow,
  type RecapRecipient,
} from "@/lib/notifications/recap-digest-emails";

function img(id: string, matchId = `match-${id}`): RecapImageRow {
  return {
    summaryImageId: id,
    matchId,
    home: "FRA",
    away: "ARG",
    comicUrl: `https://cdn.example.com/${id}.png`,
  };
}

function recipient(user_id: string, display_name: string | null = `Player ${user_id}`): RecapRecipient {
  return { user_id, display_name };
}

describe("computePendingByUser", () => {
  it("returns, per user, the comics not yet in the sent-log", () => {
    const images = [img("i1"), img("i2")];
    const recipients = [recipient("u1"), recipient("u2")];
    const sent = [{ summary_image_id: "i1", user_id: "u1" }];
    const grouped = computePendingByUser(images, recipients, sent);
    const u1 = grouped.find((g) => g.user_id === "u1");
    const u2 = grouped.find((g) => g.user_id === "u2");
    expect(u1?.images.map((i) => i.summaryImageId)).toEqual(["i2"]);
    expect(u2?.images.map((i) => i.summaryImageId)).toEqual(["i1", "i2"]);
  });

  it("omits a user with no pending comics", () => {
    const images = [img("i1")];
    const recipients = [recipient("u1"), recipient("u2")];
    const sent = [{ summary_image_id: "i1", user_id: "u1" }];
    const grouped = computePendingByUser(images, recipients, sent);
    expect(grouped.map((g) => g.user_id)).toEqual(["u2"]);
  });
});

describe("filterRecapOptIns", () => {
  it("drops opted-out users; keeps default/missing/null/non-boolean", () => {
    const grouped = [
      { user_id: "u1", display_name: null, images: [img("i1")] },
      { user_id: "u2", display_name: null, images: [img("i1")] },
      { user_id: "u3", display_name: null, images: [img("i1")] },
      { user_id: "u4", display_name: null, images: [img("i1")] },
    ];
    const kept = filterRecapOptIns(grouped, [
      { user_id: "u1", email_prefs: { recap_digest: false } }, // opted out
      { user_id: "u2", email_prefs: {} }, // missing key → opted in
      { user_id: "u3", email_prefs: null }, // null column → opted in
      { user_id: "u4", email_prefs: { recap_digest: "yes" } }, // non-boolean → opted in
    ]);
    expect(kept.map((g) => g.user_id)).toEqual(["u2", "u3", "u4"]);
  });
});

describe("buildRecapDigestStrings", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  it("uses the named heading when a display name is present", () => {
    const s = buildRecapDigestStrings(t, { displayName: "Alex" });
    expect(s.heading).toBe('heading:{"name":"Alex"}');
    expect(s.subject).toBe("subject");
  });

  it("uses the no-name heading when displayName is null", () => {
    const s = buildRecapDigestStrings(t, { displayName: null });
    expect(s.heading).toBe("headingNoName");
  });
});

// ---------------------------------------------------------------------------
// dispatchRecapDigest — gating + dedupe + opt-out
// ---------------------------------------------------------------------------

const batchSendMock = vi.fn();
const ledgerUpsertMock = vi.fn();
const getUserByIdMock = vi.fn();

let comicsData: unknown[] = [];
let matchesData: unknown[] = [];
let recipientsData: unknown[] = [];
let sentData: unknown[] = [];
let prefsData: unknown[] = [];
let resendApiKey: string | null = "re_test";

vi.mock("@/lib/env", () => ({
  env: {
    get resendApiKey() {
      return resendApiKey;
    },
    emailFrom: "World Cup Pools <test@example.com>",
    siteUrl: "https://example.com",
    supabaseUrl: "https://cdn.example.com",
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
      if (table === "match_summary_images") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: comicsData, error: null }),
          }),
        };
      }
      if (table === "matches") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: matchesData, error: null }),
          }),
        };
      }
      if (table === "v_leaderboard_overall") {
        return {
          select: () => Promise.resolve({ data: recipientsData, error: null }),
        };
      }
      if (table === "recap_digest_email_log") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: sentData, error: null }),
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
  getUserByIdMock
    .mockReset()
    .mockResolvedValue({ data: { user: { email: "player@wc26pool.com" } }, error: null });
  comicsData = [
    { id: "i1", match_id: "m1", storage_path: "m1.png" },
    { id: "i2", match_id: "m2", storage_path: "m2.png" },
  ];
  matchesData = [
    { id: "m1", home_team: "FRA", away_team: "ARG" },
    { id: "m2", home_team: "BRA", away_team: "GER" },
  ];
  recipientsData = [
    { user_id: "u1", display_name: "Alex" },
    { user_id: "u2", display_name: "Sam" },
  ];
  sentData = [];
  prefsData = [];
  resendApiKey = "re_test";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("dispatchRecapDigest", () => {
  it("no-ops without throwing when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { dispatchRecapDigest } = await import("@/lib/notifications/recap-digest-emails");
    const summary = await dispatchRecapDigest();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("emails active players and stamps the ledger only after Resend accepts", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchRecapDigest } = await import("@/lib/notifications/recap-digest-emails");
    const summary = await dispatchRecapDigest();
    expect(summary.emailed).toBe(2);
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(ledgerUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ summary_image_id: "i1", user_id: "u1" }),
        expect.objectContaining({ summary_image_id: "i2", user_id: "u1" }),
        expect.objectContaining({ summary_image_id: "i1", user_id: "u2" }),
      ]),
      expect.objectContaining({
        onConflict: "summary_image_id,user_id",
        ignoreDuplicates: true,
      }),
    );
  });

  it("leaves a failed batch pending (no ledger write, counted as failed)", async () => {
    batchSendMock.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const { dispatchRecapDigest } = await import("@/lib/notifications/recap-digest-emails");
    const summary = await dispatchRecapDigest();
    expect(summary.failed).toBe(2);
    expect(summary.emailed).toBe(0);
    expect(ledgerUpsertMock).not.toHaveBeenCalled();
  });

  it("does not re-send comics already recorded in the ledger", async () => {
    // u1 already has both comics; u2 has none → only u2 gets emailed.
    sentData = [
      { summary_image_id: "i1", user_id: "u1" },
      { summary_image_id: "i2", user_id: "u1" },
    ];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchRecapDigest } = await import("@/lib/notifications/recap-digest-emails");
    const summary = await dispatchRecapDigest();
    expect(summary.emailed).toBe(1);
  });

  it("sends nothing when there are no completed comics", async () => {
    comicsData = [];
    const { dispatchRecapDigest } = await import("@/lib/notifications/recap-digest-emails");
    const summary = await dispatchRecapDigest();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("drops a recipient who opted out of recap_digest", async () => {
    prefsData = [{ id: "u1", email_prefs: { recap_digest: false } }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchRecapDigest } = await import("@/lib/notifications/recap-digest-emails");
    const summary = await dispatchRecapDigest();
    expect(summary.emailed).toBe(1);
  });

  it("keeps a recipient with no explicit recap_digest preference", async () => {
    prefsData = [{ id: "u1", email_prefs: {} }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchRecapDigest } = await import("@/lib/notifications/recap-digest-emails");
    const summary = await dispatchRecapDigest();
    expect(summary.emailed).toBe(2);
  });

  it("counts an unresolvable email as skipped, not failed", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchRecapDigest } = await import("@/lib/notifications/recap-digest-emails");
    const summary = await dispatchRecapDigest();
    expect(summary.skipped).toBe(2);
    expect(summary.emailed).toBe(0);
    expect(batchSendMock).not.toHaveBeenCalled();
  });
});
