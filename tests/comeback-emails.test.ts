import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderComebackEmail,
  type ComebackEmailData,
  type ComebackEmailStrings,
} from "@/lib/notifications/comeback-email-template";

// ---------------------------------------------------------------------------
// renderComebackEmail — pure renderer
// ---------------------------------------------------------------------------

const STRINGS: ComebackEmailStrings = {
  subject: "We miss your picks",
  preheader: "Jump back in before the next kickoff.",
  eyebrow: "Come back",
  heading: "Alex, the pool misses you",
  intro: "You've gone quiet, but there are still matches to predict.",
  daysInactiveLabel: "7 days since your last pick",
  rankLabel: "Currently #4",
  unrankedLabel: "Not ranked yet",
  pointsLabel: "12 points",
  matchesLabel: "Next up to predict",
  vs: "vs",
  ctaLabel: "Make your picks",
  footer: "You're getting this because you haven't predicted in a while.",
  unsubscribeLabel: "Unsubscribe from comeback emails",
};

function makeData(overrides: Partial<ComebackEmailData> = {}): ComebackEmailData {
  return {
    strings: STRINGS,
    rank: 4,
    totalPoints: 12,
    matches: [
      { home: "Brazil", away: "Mexico", kickoffLabel: "12:00 UTC" },
      { home: "France", away: "Argentina", kickoffLabel: "15:00 UTC" },
    ],
    predictionsUrl: "https://example.com/en/matches?picks=needed",
    unsubscribeUrl: "https://example.com/api/comeback-emails/unsubscribe?token=tok1",
    ...overrides,
  };
}

describe("renderComebackEmail", () => {
  it("returns subject/html/text without DB or network", () => {
    const out = renderComebackEmail(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("<!DOCTYPE html>");
    expect(typeof out.text).toBe("string");
  });

  it("shows days since last pick, rank, points, and the next matches", () => {
    const out = renderComebackEmail(makeData());
    expect(out.html).toContain("7 days since your last pick");
    expect(out.html).toContain("Currently #4");
    expect(out.html).toContain("12 points");
    expect(out.html).toContain("Brazil");
    expect(out.html).toContain("Argentina");
    expect(out.html).toContain("12:00 UTC");
    expect(out.text).toContain("Brazil vs Mexico (12:00 UTC)");
  });

  it("renders an unranked state when rank is null and omits points", () => {
    const out = renderComebackEmail(makeData({ rank: null }));
    expect(out.html).toContain("Not ranked yet");
    expect(out.html).not.toContain("Currently #4");
    expect(out.text).toContain("Not ranked yet");
    // still shows days + next matches + cta
    expect(out.html).toContain("7 days since your last pick");
    expect(out.html).toContain("Brazil");
  });

  it("deep links the CTA to /matches?picks=needed and includes the unsubscribe link", () => {
    const out = renderComebackEmail(makeData());
    expect(out.html).toContain("https://example.com/en/matches?picks=needed");
    expect(out.html).toContain(
      "https://example.com/api/comeback-emails/unsubscribe?token=tok1",
    );
    expect(out.text).toContain("https://example.com/en/matches?picks=needed");
    expect(out.text).toContain("unsubscribe?token=tok1");
  });

  it("uses email-safe styling — no oklch, CSS variables, or stylesheets", () => {
    const out = renderComebackEmail(makeData());
    expect(out.html).not.toMatch(/oklch/i);
    expect(out.html).not.toContain("var(--");
    expect(out.html).not.toContain("<link");
    expect(out.html).not.toContain("class=");
  });

  it("escapes HTML in copy and team names to prevent injection", () => {
    const out = renderComebackEmail(
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
// computePendingComebackEmails + buildComebackEmailStrings — pure
// ---------------------------------------------------------------------------

import {
  buildComebackEmailStrings,
  computePendingComebackEmails,
  formatKickoffLabel,
  INACTIVITY_DAYS,
  COOLDOWN_DAYS,
  type ComebackProfile,
  type PickableMatch,
} from "@/lib/notifications/comeback-emails";

const NOW = new Date("2030-06-20T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function prof(id: string, emailPrefs: unknown = {}): ComebackProfile {
  return { userId: id, displayName: id, unsubscribeToken: `tok-${id}`, emailPrefs };
}

const PM: PickableMatch = {
  id: "m1",
  home_team: "Brazil",
  away_team: "Mexico",
  kickoff_at: "2030-06-25T12:00:00.000Z",
};

// An ISO `days` before NOW.
function ago(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

describe("computePendingComebackEmails", () => {
  it("includes an inactive player with a pickable match", () => {
    const pending = computePendingComebackEmails(
      [prof("u1")],
      [{ user_id: "u1", last_submitted_at: ago(INACTIVITY_DAYS + 2) }],
      [PM],
      [],
      NOW,
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].profile.userId).toBe("u1");
    expect(pending[0].daysSinceLastPick).toBe(INACTIVITY_DAYS + 2);
    expect(pending[0].matches).toEqual([PM]);
  });

  it("suppresses a recently-active player", () => {
    const pending = computePendingComebackEmails(
      [prof("u1")],
      [{ user_id: "u1", last_submitted_at: ago(1) }],
      [PM],
      [],
      NOW,
    );
    expect(pending).toHaveLength(0);
  });

  it("excludes a player with zero predictions", () => {
    const pending = computePendingComebackEmails([prof("u1")], [], [PM], [], NOW);
    expect(pending).toHaveLength(0);
  });

  it("drops a player opted out of comeback emails", () => {
    const pending = computePendingComebackEmails(
      [prof("u1", { comeback: false })],
      [{ user_id: "u1", last_submitted_at: ago(INACTIVITY_DAYS + 2) }],
      [PM],
      [],
      NOW,
    );
    expect(pending).toHaveLength(0);
  });

  it("suppresses a player within the cooldown window", () => {
    const pending = computePendingComebackEmails(
      [prof("u1")],
      [{ user_id: "u1", last_submitted_at: ago(INACTIVITY_DAYS + 2) }],
      [PM],
      [{ user_id: "u1", sent_at: ago(COOLDOWN_DAYS - 1) }],
      NOW,
    );
    expect(pending).toHaveLength(0);
  });

  it("re-includes a player whose cooldown has elapsed", () => {
    const pending = computePendingComebackEmails(
      [prof("u1")],
      [{ user_id: "u1", last_submitted_at: ago(INACTIVITY_DAYS + 2) }],
      [PM],
      [{ user_id: "u1", sent_at: ago(COOLDOWN_DAYS + 1) }],
      NOW,
    );
    expect(pending).toHaveLength(1);
  });

  it("returns nobody when there is no pickable match", () => {
    const pending = computePendingComebackEmails(
      [prof("u1")],
      [{ user_id: "u1", last_submitted_at: ago(INACTIVITY_DAYS + 2) }],
      [],
      [],
      NOW,
    );
    expect(pending).toHaveLength(0);
  });
});

describe("buildComebackEmailStrings", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  it("uses the named heading and interpolates days/rank/points", () => {
    const s = buildComebackEmailStrings(t, {
      displayName: "Alex",
      daysSinceLastPick: 7,
      rank: 4,
      totalPoints: 12,
    });
    expect(s.heading).toBe('heading:{"name":"Alex"}');
    expect(s.daysInactiveLabel).toBe('daysInactiveLabel:{"days":7}');
    expect(s.rankLabel).toBe('rankLabel:{"rank":4}');
    expect(s.pointsLabel).toBe('pointsLabel:{"points":12}');
  });

  it("falls back to the unranked label when rank is null", () => {
    const s = buildComebackEmailStrings(t, {
      displayName: null,
      daysSinceLastPick: 7,
      rank: null,
      totalPoints: 0,
    });
    expect(s.heading).toBe("headingNoName");
    expect(s.rankLabel).toBe("unrankedLabel");
  });
});

describe("formatKickoffLabel", () => {
  it("formats the kickoff at UTC with the zone shown", () => {
    expect(formatKickoffLabel("2030-06-01T12:00:00.000Z")).toBe("12:00 UTC");
  });
});

// ---------------------------------------------------------------------------
// dispatchComebackEmails — gating + eligibility + ledger/failure behavior
// ---------------------------------------------------------------------------

const batchSendMock = vi.fn();
const insertMock = vi.fn();
const getUserByIdMock = vi.fn();

let matchData: unknown[] = [];
let profileData: unknown[] = [];
let predictionData: unknown[] = [];
let ledgerData: unknown[] = [];
let standingsData: unknown[] = [];
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

function pagedRange(getData: () => unknown[]) {
  return {
    range: (from: number, to: number) =>
      Promise.resolve({ data: getData().slice(from, to + 1), error: null }),
  };
}
function matchesSelect(getData: () => unknown[]) {
  return { gte: () => ({ order: () => pagedRange(getData) }) };
}
function orderSelect(getData: () => unknown[]) {
  return { order: () => pagedRange(getData) };
}
function inSelect(getData: () => unknown[]) {
  return { in: () => Promise.resolve({ data: getData(), error: null }) };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "matches") return { select: () => matchesSelect(() => matchData) };
      if (table === "profiles") return { select: () => orderSelect(() => profileData) };
      if (table === "predictions") return { select: () => orderSelect(() => predictionData) };
      if (table === "comeback_email_log") {
        return { select: () => orderSelect(() => ledgerData), insert: insertMock };
      }
      if (table === "v_leaderboard_overall") {
        return { select: () => inSelect(() => standingsData) };
      }
      throw new Error(`unexpected from(${table})`);
    },
    auth: { admin: { getUserById: getUserByIdMock } },
  })),
}));

// A pickable match well in the future from RUN_NOW.
const FUTURE = "2030-06-25T12:00:00.000Z";
const RUN_NOW = new Date("2030-06-20T00:00:00.000Z");
const OLD_PICK = new Date(RUN_NOW.getTime() - 10 * DAY).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(RUN_NOW);
  batchSendMock.mockReset();
  insertMock.mockReset().mockResolvedValue({ error: null });
  getUserByIdMock
    .mockReset()
    .mockResolvedValue({ data: { user: { email: "player@playmail.io" } }, error: null });
  matchData = [
    { id: "m1", home_team: "Brazil", away_team: "Mexico", kickoff_at: FUTURE, status: "scheduled" },
  ];
  profileData = [{ id: "u1", display_name: "Alex", unsubscribe_token: "tok1", email_prefs: {} }];
  predictionData = [{ id: "p1", user_id: "u1", submitted_at: OLD_PICK }];
  ledgerData = [];
  standingsData = [{ user_id: "u1", rank: 4, total_points: 12 }];
  resendApiKey = "re_test";
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("dispatchComebackEmails", () => {
  it("no-ops without throwing when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { dispatchComebackEmails } = await import("@/lib/notifications/comeback-emails");
    const summary = await dispatchComebackEmails();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("no-ops when there are no pickable matches", async () => {
    matchData = [];
    const { dispatchComebackEmails } = await import("@/lib/notifications/comeback-emails");
    const summary = await dispatchComebackEmails();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("emails an inactive player and stamps the ledger only after send", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchComebackEmails } = await import("@/lib/notifications/comeback-emails");
    const summary = await dispatchComebackEmails();
    expect(summary.emailed).toBe(1);
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith([{ user_id: "u1" }]);
  });

  it("excludes a recently-active player", async () => {
    predictionData = [{ id: "p1", user_id: "u1", submitted_at: new Date(RUN_NOW.getTime() - DAY).toISOString() }];
    const { dispatchComebackEmails } = await import("@/lib/notifications/comeback-emails");
    const summary = await dispatchComebackEmails();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("excludes a player opted out of comeback emails", async () => {
    profileData = [
      { id: "u1", display_name: "Alex", unsubscribe_token: "tok1", email_prefs: { comeback: false } },
    ];
    const { dispatchComebackEmails } = await import("@/lib/notifications/comeback-emails");
    const summary = await dispatchComebackEmails();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("excludes a player within the cooldown window", async () => {
    ledgerData = [{ user_id: "u1", sent_at: new Date(RUN_NOW.getTime() - DAY).toISOString() }];
    const { dispatchComebackEmails } = await import("@/lib/notifications/comeback-emails");
    const summary = await dispatchComebackEmails();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("sets a List-Unsubscribe header on each message", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchComebackEmails } = await import("@/lib/notifications/comeback-emails");
    await dispatchComebackEmails();
    const payloads = batchSendMock.mock.calls[0][0] as { headers: Record<string, string> }[];
    expect(payloads[0].headers["List-Unsubscribe"]).toContain("token=tok1");
  });

  it("leaves a failed send pending (no ledger write, counted as failed)", async () => {
    batchSendMock.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const { dispatchComebackEmails } = await import("@/lib/notifications/comeback-emails");
    const summary = await dispatchComebackEmails();
    expect(summary.failed).toBe(1);
    expect(summary.emailed).toBe(0);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("skips a recipient whose email cannot be resolved", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
    const { dispatchComebackEmails } = await import("@/lib/notifications/comeback-emails");
    const summary = await dispatchComebackEmails();
    expect(summary.skipped).toBe(1);
    expect(summary.emailed).toBe(0);
    expect(batchSendMock).not.toHaveBeenCalled();
  });
});
