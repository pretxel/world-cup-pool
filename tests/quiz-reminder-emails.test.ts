import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderQuizReminderEmail,
  type QuizReminderEmailData,
  type QuizReminderEmailStrings,
} from "@/lib/notifications/quiz-reminder-template";

// ---------------------------------------------------------------------------
// renderQuizReminderEmail — pure renderer
// ---------------------------------------------------------------------------

const STRINGS: QuizReminderEmailStrings = {
  subject: "Today's quiz is live",
  preheader: "One question, ten seconds.",
  eyebrow: "Daily quiz",
  heading: "Alex, today's question is up",
  intro: "A fresh question is waiting.",
  streakLine: "You're on a 4-day streak — don't let it slip.",
  ctaLabel: "Answer today's question",
  footer: "You're getting this because you're playing the World Cup pool.",
  unsubscribeLabel: "Unsubscribe from daily quiz reminders",
};

function makeData(overrides: Partial<QuizReminderEmailData> = {}): QuizReminderEmailData {
  return {
    strings: STRINGS,
    quizUrl: "https://example.com/en/quiz",
    unsubscribeUrl: "https://example.com/api/quiz-reminders/unsubscribe?token=tok1",
    ...overrides,
  };
}

describe("renderQuizReminderEmail", () => {
  it("returns subject/html/text without DB or network", () => {
    const out = renderQuizReminderEmail(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("<!DOCTYPE html>");
    expect(typeof out.text).toBe("string");
  });

  it("deep links the CTA to the quiz and includes the unsubscribe link", () => {
    const out = renderQuizReminderEmail(makeData());
    expect(out.html).toContain("https://example.com/en/quiz");
    expect(out.html).toContain("https://example.com/api/quiz-reminders/unsubscribe?token=tok1");
    expect(out.text).toContain("https://example.com/en/quiz");
    expect(out.text).toContain("unsubscribe?token=tok1");
  });

  it("shows the streak clause when present and omits it when null", () => {
    const withStreak = renderQuizReminderEmail(makeData());
    expect(withStreak.html).toContain("4-day streak");
    expect(withStreak.text).toContain("4-day streak");

    const without = renderQuizReminderEmail(
      makeData({ strings: { ...STRINGS, streakLine: null } }),
    );
    expect(without.html).not.toContain("streak");
    expect(without.text).not.toContain("streak");
  });

  it("uses email-safe styling — no oklch, CSS variables, or stylesheets", () => {
    const out = renderQuizReminderEmail(makeData());
    expect(out.html).not.toMatch(/oklch/i);
    expect(out.html).not.toContain("var(--");
    expect(out.html).not.toContain("<link");
    expect(out.html).not.toContain("class=");
  });

  it("escapes HTML in copy to prevent injection", () => {
    const out = renderQuizReminderEmail(
      makeData({ strings: { ...STRINGS, heading: "<script>alert(1)</script>" } }),
    );
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
  });
});

// ---------------------------------------------------------------------------
// computePendingReminders + buildQuizReminderStrings — pure logic
// ---------------------------------------------------------------------------

import {
  buildQuizReminderStrings,
  computePendingReminders,
  type ReminderRecipient,
} from "@/lib/notifications/quiz-reminder-emails";

function recip(id: string): ReminderRecipient {
  return { userId: id, displayName: id, unsubscribeToken: `tok-${id}`, timezone: null };
}

describe("computePendingReminders", () => {
  it("keeps users who have neither answered nor been reminded", () => {
    const pending = computePendingReminders([recip("u1"), recip("u2")], [], []);
    expect(pending.map((p) => p.userId)).toEqual(["u1", "u2"]);
  });

  it("excludes users who already answered today", () => {
    const pending = computePendingReminders([recip("u1"), recip("u2")], ["u1"], []);
    expect(pending.map((p) => p.userId)).toEqual(["u2"]);
  });

  it("excludes users already in the reminder ledger", () => {
    const pending = computePendingReminders([recip("u1"), recip("u2")], [], ["u2"]);
    expect(pending.map((p) => p.userId)).toEqual(["u1"]);
  });
});

describe("buildQuizReminderStrings", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  it("uses the named heading and a streak line when streak > 0", () => {
    const s = buildQuizReminderStrings(t, { displayName: "Alex", streak: 4 });
    expect(s.heading).toBe('heading:{"name":"Alex"}');
    expect(s.streakLine).toBe('streakLine:{"days":4}');
  });

  it("uses the no-name heading and null streak line otherwise", () => {
    const s = buildQuizReminderStrings(t, { displayName: null, streak: 0 });
    expect(s.heading).toBe("headingNoName");
    expect(s.streakLine).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dispatchQuizReminders — gating + eligibility + ledger/failure behavior
// ---------------------------------------------------------------------------

const batchSendMock = vi.fn();
const upsertMock = vi.fn();
const getUserByIdMock = vi.fn();

let questionData: { id: string } | null = { id: "q1" };
let profileData: unknown[] = [];
let answeredData: unknown[] = [];
let sentData: unknown[] = [];
let streakData: unknown[] = [];
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

// A paged `.eq().order().range(from, to)` terminal that slices the dataset, so
// the dispatcher's pagination loop is exercised realistically (and proven not
// to truncate). `.order().range()` (no `.eq()`) is the profiles loader's shape
// since opt-out is now filtered in JS off email_prefs. `.in()` is the streak
// query's terminal.
function pagedSelect(getData: () => unknown[]) {
  return {
    eq: () => ({
      order: () => ({
        range: (from: number, to: number) =>
          Promise.resolve({ data: getData().slice(from, to + 1), error: null }),
      }),
    }),
    order: () => ({
      range: (from: number, to: number) =>
        Promise.resolve({ data: getData().slice(from, to + 1), error: null }),
    }),
    in: () => Promise.resolve({ data: streakData, error: null }),
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "quiz_questions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: questionData, error: null }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return { select: () => pagedSelect(() => profileData) };
      }
      if (table === "quiz_answers") {
        return { select: () => pagedSelect(() => answeredData) };
      }
      if (table === "quiz_reminder_log") {
        return { select: () => pagedSelect(() => sentData), upsert: upsertMock };
      }
      throw new Error(`unexpected from(${table})`);
    },
    auth: { admin: { getUserById: getUserByIdMock } },
  })),
}));

// The dispatcher buckets recipients to ~7am local; with a null timezone the
// fallback is UTC, so the run must be at 07:00 UTC for the eligibility tests
// below to send. Frozen via fake timers in beforeEach.
const RUN_NOW = new Date("2030-06-01T07:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(RUN_NOW);
  batchSendMock.mockReset();
  upsertMock.mockReset().mockResolvedValue({ error: null });
  getUserByIdMock
    .mockReset()
    .mockResolvedValue({ data: { user: { email: "player@example.com" } }, error: null });
  questionData = { id: "q1" };
  profileData = [{ id: "u1", display_name: "Alex", unsubscribe_token: "tok1" }];
  answeredData = [];
  sentData = [];
  streakData = [];
  resendApiKey = "re_test";
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("dispatchQuizReminders", () => {
  it("no-ops without throwing when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("no-ops when there is no active question for today", async () => {
    questionData = null;
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("emails an eligible user and stamps the ledger only after send", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary.emailed).toBe(1);
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      [{ user_id: "u1", question_id: "q1" }],
      expect.objectContaining({ onConflict: "user_id,question_id", ignoreDuplicates: true }),
    );
  });

  it("excludes a user opted out of quiz reminders via email_prefs", async () => {
    profileData = [
      {
        id: "u1",
        display_name: "Alex",
        unsubscribe_token: "tok1",
        email_prefs: { quiz_reminder: false },
      },
    ];
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("still emails a user with no explicit quiz_reminder preference", async () => {
    profileData = [
      { id: "u1", display_name: "Alex", unsubscribe_token: "tok1", email_prefs: {} },
    ];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary.emailed).toBe(1);
  });

  it("sets a List-Unsubscribe header on each message", async () => {
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    await dispatchQuizReminders();
    const payloads = batchSendMock.mock.calls[0][0] as { headers: Record<string, string> }[];
    expect(payloads[0].headers["List-Unsubscribe"]).toContain("token=tok1");
  });

  it("excludes a user who already answered today's question", async () => {
    answeredData = [{ user_id: "u1" }];
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("excludes a user already recorded in the reminder ledger", async () => {
    sentData = [{ user_id: "u1" }];
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("leaves a failed send pending (no ledger write, counted as failed)", async () => {
    batchSendMock.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary.failed).toBe(1);
    expect(summary.emailed).toBe(0);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("skips a recipient whose email cannot be resolved", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
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
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary.emailed).toBe(150);
    expect(batchSendMock).toHaveBeenCalledTimes(2);
    expect(batchSendMock.mock.calls[0][0]).toHaveLength(100);
    expect(batchSendMock.mock.calls[1][0]).toHaveLength(50);
  });

  it("pages past the 1000-row query cap without dropping recipients", async () => {
    // More opted-in profiles than a single Supabase page returns — the loader
    // must page through them all, not silently stop at 1000.
    profileData = Array.from({ length: 1500 }, (_, i) => ({
      id: `u${i}`,
      display_name: "Player",
      unsubscribe_token: `tok${i}`,
    }));
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary.emailed).toBe(1500);
    // 1500 recipients / 100-per-batch = 15 send batches.
    expect(batchSendMock).toHaveBeenCalledTimes(15);
  });

  // --- Local-7am bucketing under the hourly schedule ----------------------
  // RUN_NOW is 07:00 UTC. A user is emailed only when it is ~7am in their zone.

  it("emails a user for whom the run hour is their local 7am", async () => {
    // Atlantic/Reykjavik is UTC+0 year-round, so 07:00 UTC == 07:00 local.
    profileData = [
      { id: "u1", display_name: "Alex", unsubscribe_token: "tok1", timezone: "Atlantic/Reykjavik" },
    ];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary.emailed).toBe(1);
  });

  it("excludes a user whose local hour is not 7 at the run instant", async () => {
    // At 07:00 UTC it is 09:00 in Europe/Madrid (CEST, +02) — NOT their 7am.
    profileData = [
      { id: "u1", display_name: "Alex", unsubscribe_token: "tok1", timezone: "Europe/Madrid" },
    ];
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("emails a null-timezone user via the UTC fallback at 07:00 UTC", async () => {
    profileData = [{ id: "u1", display_name: "Alex", unsubscribe_token: "tok1", timezone: null }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary.emailed).toBe(1);
  });

  it("does not email a null-timezone user off the UTC fallback hour", async () => {
    vi.setSystemTime(new Date("2030-06-01T10:00:00.000Z"));
    profileData = [{ id: "u1", display_name: "Alex", unsubscribe_token: "tok1", timezone: null }];
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });
});

describe("dispatchQuizReminders force re-send", () => {
  it("re-emails an already-reminded but unanswered user and still upserts the ledger", async () => {
    sentData = [{ user_id: "u1" }];
    batchSendMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders(undefined, { force: true });
    expect(summary.emailed).toBe(1);
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      [{ user_id: "u1", question_id: "q1" }],
      expect.objectContaining({ onConflict: "user_id,question_id", ignoreDuplicates: true }),
    );
  });

  it("without force, still excludes an already-reminded user (regression)", async () => {
    sentData = [{ user_id: "u1" }];
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders();
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("still excludes a user who already answered, even with force", async () => {
    answeredData = [{ user_id: "u1" }];
    sentData = [{ user_id: "u1" }];
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders(undefined, { force: true });
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("no-ops with force when there is no active question", async () => {
    questionData = null;
    const { dispatchQuizReminders } = await import("@/lib/notifications/quiz-reminder-emails");
    const summary = await dispatchQuizReminders(undefined, { force: true });
    expect(summary).toEqual({ emailed: 0, failed: 0, skipped: 0 });
    expect(batchSendMock).not.toHaveBeenCalled();
  });
});
