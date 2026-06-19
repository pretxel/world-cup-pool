import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderPredictionReminderEmail,
  type PredictionReminderEmailData,
  type PredictionReminderEmailStrings,
} from "@/lib/notifications/prediction-reminder-template";

// ---------------------------------------------------------------------------
// renderPredictionReminderEmail — pure renderer
// ---------------------------------------------------------------------------

const STRINGS: PredictionReminderEmailStrings = {
  subject: "Today's matches — get your predictions in",
  preheader: "You still have picks to make before kickoff.",
  eyebrow: "Today's matches",
  heading: "Alex, you've got picks to make",
  intro: "These matches kick off today and you haven't predicted them yet.",
  listLabel: "Still to predict",
  vs: "vs",
  ctaLabel: "Make your predictions",
  footer: "You're getting this because you're playing the World Cup pool.",
  unsubscribeLabel: "Unsubscribe from daily prediction reminders",
};

function makeData(overrides: Partial<PredictionReminderEmailData> = {}): PredictionReminderEmailData {
  return {
    strings: STRINGS,
    matches: [
      { home: "Brazil", away: "Mexico", kickoffLabel: "12:00 UTC" },
      { home: "France", away: "Argentina", kickoffLabel: "15:00 UTC" },
    ],
    predictionsUrl: "https://example.com/en/matches?picks=needed",
    unsubscribeUrl: "https://example.com/api/prediction-reminders/unsubscribe?token=tok1",
    ...overrides,
  };
}

describe("renderPredictionReminderEmail", () => {
  it("returns subject/html/text without DB or network", () => {
    const out = renderPredictionReminderEmail(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("<!DOCTYPE html>");
    expect(typeof out.text).toBe("string");
  });

  it("lists every pending fixture with teams and kickoff time", () => {
    const out = renderPredictionReminderEmail(makeData());
    expect(out.html).toContain("Brazil");
    expect(out.html).toContain("Mexico");
    expect(out.html).toContain("France");
    expect(out.html).toContain("Argentina");
    expect(out.html).toContain("12:00 UTC");
    expect(out.html).toContain("15:00 UTC");
    expect(out.text).toContain("Brazil vs Mexico (12:00 UTC)");
    expect(out.text).toContain("France vs Argentina (15:00 UTC)");
  });

  it("deep links the CTA to predictions and includes the unsubscribe link", () => {
    const out = renderPredictionReminderEmail(makeData());
    expect(out.html).toContain("https://example.com/en/matches?picks=needed");
    expect(out.html).toContain(
      "https://example.com/api/prediction-reminders/unsubscribe?token=tok1",
    );
    expect(out.text).toContain("https://example.com/en/matches?picks=needed");
    expect(out.text).toContain("unsubscribe?token=tok1");
  });

  it("uses email-safe styling — no oklch, CSS variables, or stylesheets", () => {
    const out = renderPredictionReminderEmail(makeData());
    expect(out.html).not.toMatch(/oklch/i);
    expect(out.html).not.toContain("var(--");
    expect(out.html).not.toContain("<link");
    expect(out.html).not.toContain("class=");
  });

  it("escapes HTML in copy and team names to prevent injection", () => {
    const out = renderPredictionReminderEmail(
      makeData({
        strings: { ...STRINGS, heading: "<script>alert(1)</script>" },
        matches: [{ home: "<b>x</b>", away: "Mexico", kickoffLabel: "12:00 UTC" }],
      }),
    );
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).not.toContain("<b>x</b>");
  });
});

// ---------------------------------------------------------------------------
// computePendingPredictionReminders + buildPredictionReminderStrings — pure
// ---------------------------------------------------------------------------

import {
  buildPredictionReminderStrings,
  computePendingPredictionReminders,
  formatKickoffLabel,
  type PredictionRecipient,
  type TodayMatch,
} from "@/lib/notifications/prediction-reminder-emails";

function recip(id: string): PredictionRecipient {
  return { userId: id, displayName: id, unsubscribeToken: `tok-${id}`, timezone: null };
}

const M1: TodayMatch = { id: "m1", home_team: "Brazil", away_team: "Mexico", kickoff_at: "x" };
const M2: TodayMatch = { id: "m2", home_team: "France", away_team: "Argentina", kickoff_at: "y" };

describe("computePendingPredictionReminders", () => {
  it("keeps users with at least one unpredicted match, not yet reminded", () => {
    const pending = computePendingPredictionReminders([recip("u1")], [M1, M2], [], []);
    expect(pending).toHaveLength(1);
    expect(pending[0].matches.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("excludes matches a user already predicted", () => {
    const pending = computePendingPredictionReminders(
      [recip("u1")],
      [M1, M2],
      [{ user_id: "u1", match_id: "m1" }],
      [],
    );
    expect(pending[0].matches.map((m) => m.id)).toEqual(["m2"]);
  });

  it("drops a user who has predicted every today match", () => {
    const pending = computePendingPredictionReminders(
      [recip("u1")],
      [M1],
      [{ user_id: "u1", match_id: "m1" }],
      [],
    );
    expect(pending).toHaveLength(0);
  });

  it("excludes users already reminded today", () => {
    const pending = computePendingPredictionReminders([recip("u1"), recip("u2")], [M1], [], ["u1"]);
    expect(pending.map((p) => p.recipient.userId)).toEqual(["u2"]);
  });
});

describe("buildPredictionReminderStrings", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  it("uses the named heading when a display name is present", () => {
    const s = buildPredictionReminderStrings(t, { displayName: "Alex" });
    expect(s.heading).toBe('heading:{"name":"Alex"}');
  });

  it("uses the no-name heading otherwise", () => {
    const s = buildPredictionReminderStrings(t, { displayName: null });
    expect(s.heading).toBe("headingNoName");
  });
});

describe("formatKickoffLabel", () => {
  it("formats the kickoff at UTC with the zone shown", () => {
    expect(formatKickoffLabel("2030-06-01T12:00:00.000Z")).toBe("12:00 UTC");
    expect(formatKickoffLabel("2030-06-01T20:30:00.000Z")).toBe("20:30 UTC");
  });
});

// ---------------------------------------------------------------------------
// dispatchPredictionReminders — gating + eligibility + ledger/failure behavior
// ---------------------------------------------------------------------------

const batchSendMock = vi.fn();
const upsertMock = vi.fn();
const getUserByIdMock = vi.fn();

const FUTURE = "2030-06-01T12:00:00.000Z";
// The dispatcher buckets recipients to ~7am local: with a null timezone the
// fallback is UTC, so the run must be at 07:00 UTC (same day as FUTURE) for the
// eligibility tests below to send. Frozen via fake timers in beforeEach.
const RUN_NOW = new Date("2030-06-01T07:00:00.000Z");
let matchData: unknown[] = [];
let profileData: unknown[] = [];
let predictionData: unknown[] = [];
let ledgerData: unknown[] = [];
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

// Terminals that slice the dataset so the dispatcher's pagination loop runs
// realistically (and is proven not to truncate). Each table uses the filter
// shape the loader applies before .order().range().
function pagedRange(getData: () => unknown[]) {
  return {
    range: (from: number, to: number) =>
      Promise.resolve({ data: getData().slice(from, to + 1), error: null }),
  };
}
function matchesSelect(getData: () => unknown[]) {
  return { gte: () => ({ lt: () => ({ order: () => pagedRange(getData) }) }) };
}
function eqSelect(getData: () => unknown[]) {
  return { eq: () => ({ order: () => pagedRange(getData) }) };
}
// The profiles loader no longer filters with `.eq(opt_out)` — opt-out is applied
// in JS off email_prefs — so its terminal is `.order().range()` directly.
function orderSelect(getData: () => unknown[]) {
  return { order: () => pagedRange(getData) };
}
function inSelect(getData: () => unknown[]) {
  return { in: () => ({ order: () => pagedRange(getData) }) };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "matches") return { select: () => matchesSelect(() => matchData) };
      if (table === "profiles") return { select: () => orderSelect(() => profileData) };
      if (table === "predictions") return { select: () => inSelect(() => predictionData) };
      if (table === "prediction_reminder_log") {
        return { select: () => eqSelect(() => ledgerData), upsert: upsertMock };
      }
      throw new Error(`unexpected from(${table})`);
    },
    auth: { admin: { getUserById: getUserByIdMock } },
  })),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(RUN_NOW);
  batchSendMock.mockReset();
  upsertMock.mockReset().mockResolvedValue({ error: null });
  getUserByIdMock
    .mockReset()
    .mockResolvedValue({ data: { user: { email: "player@example.com" } }, error: null });
  matchData = [
    { id: "m1", home_team: "Brazil", away_team: "Mexico", kickoff_at: FUTURE, status: "scheduled" },
  ];
  profileData = [{ id: "u1", display_name: "Alex", unsubscribe_token: "tok1" }];
  predictionData = [];
  ledgerData = [];
  resendApiKey = "re_test";
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("dispatchPredictionReminders", () => {
  it("no-ops without throwing when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("no-ops when there are no open matches today", async () => {
    matchData = [];
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("excludes a player opted out of prediction reminders via email_prefs", async () => {
    profileData = [
      {
        id: "u1",
        display_name: "Alex",
        unsubscribe_token: "tok1",
        email_prefs: { prediction_reminder: false },
      },
    ];
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("still emails a player with no explicit prediction_reminder preference", async () => {
    profileData = [
      { id: "u1", display_name: "Alex", unsubscribe_token: "tok1", email_prefs: {} },
    ];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary.emailed).toBe(1);
  });

  it("drops locked and placeholder matches before computing recipients", async () => {
    matchData = [
      { id: "live", home_team: "Brazil", away_team: "Mexico", kickoff_at: FUTURE, status: "live" },
      {
        id: "ph",
        home_team: "Winner Match 73",
        away_team: "2nd Group A",
        kickoff_at: FUTURE,
        status: "scheduled",
      },
    ];
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("emails an eligible player and stamps the ledger only after send", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary.emailed).toBe(1);
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      [{ user_id: "u1", reminder_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }],
      expect.objectContaining({ onConflict: "user_id,reminder_date", ignoreDuplicates: true }),
    );
  });

  it("sets a List-Unsubscribe header on each message", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    await dispatchPredictionReminders();
    const payloads = batchSendMock.mock.calls[0][0] as { headers: Record<string, string> }[];
    expect(payloads[0].headers["List-Unsubscribe"]).toContain("token=tok1");
  });

  it("skips a player who has already predicted every today match", async () => {
    predictionData = [{ user_id: "u1", match_id: "m1" }];
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("excludes a player already recorded in today's ledger", async () => {
    ledgerData = [{ user_id: "u1" }];
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("leaves a failed send pending (no ledger write, counted as failed)", async () => {
    batchSendMock.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary.failed).toBe(1);
    expect(summary.emailed).toBe(0);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("skips a recipient whose email cannot be resolved", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary.skipped).toBe(1);
    expect(summary.emailed).toBe(0);
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("batches large recipient sets at the ≤100 Resend limit", async () => {
    profileData = Array.from({ length: 150 }, (_, i) => ({
      id: `u${i}`,
      display_name: "Player",
      unsubscribe_token: `tok${i}`,
    }));
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary.emailed).toBe(150);
    expect(batchSendMock).toHaveBeenCalledTimes(2);
    expect(batchSendMock.mock.calls[0][0]).toHaveLength(100);
    expect(batchSendMock.mock.calls[1][0]).toHaveLength(50);
  });

  it("pages past the 1000-row query cap without dropping recipients", async () => {
    profileData = Array.from({ length: 1500 }, (_, i) => ({
      id: `u${i}`,
      display_name: "Player",
      unsubscribe_token: `tok${i}`,
    }));
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary.emailed).toBe(1500);
    expect(batchSendMock).toHaveBeenCalledTimes(15);
  });

  // --- Local-7am bucketing under the hourly schedule ----------------------
  // RUN_NOW is 07:00 UTC. A user is emailed only when it is ~7am in their zone.

  it("excludes a user whose local hour is not 7 at the run instant", async () => {
    // At 07:00 UTC it is 09:00 in Europe/Madrid (CEST, +02) — NOT their 7am.
    profileData = [
      { id: "u1", display_name: "Alex", unsubscribe_token: "tok1", timezone: "Europe/Madrid" },
    ];
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("emails a user for whom the run hour is their local 7am", async () => {
    // Atlantic/Reykjavik is UTC+0 year-round, so 07:00 UTC == 07:00 local.
    profileData = [
      { id: "u1", display_name: "Alex", unsubscribe_token: "tok1", timezone: "Atlantic/Reykjavik" },
    ];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary.emailed).toBe(1);
  });

  it("emails a null-timezone user via the UTC fallback at 07:00 UTC", async () => {
    profileData = [{ id: "u1", display_name: "Alex", unsubscribe_token: "tok1", timezone: null }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary.emailed).toBe(1);
  });

  it("does not email a null-timezone user off the UTC fallback hour", async () => {
    vi.setSystemTime(new Date("2030-06-01T10:00:00.000Z"));
    profileData = [{ id: "u1", display_name: "Alex", unsubscribe_token: "tok1", timezone: null }];
    const { dispatchPredictionReminders } = await import(
      "@/lib/notifications/prediction-reminder-emails"
    );
    const summary = await dispatchPredictionReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });
});
