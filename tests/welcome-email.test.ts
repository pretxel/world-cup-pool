import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderWelcomeEmail,
  type WelcomeEmailData,
  type WelcomeEmailStrings,
} from "@/lib/notifications/welcome-email-template";

// ---------------------------------------------------------------------------
// renderWelcomeEmail — pure renderer
// ---------------------------------------------------------------------------

const STRINGS: WelcomeEmailStrings = {
  subject: "Welcome to the World Cup pool",
  preheader: "Your first picks await.",
  eyebrow: "You're in",
  heading: "Welcome, Alex!",
  headingNoName: "Welcome to the pool!",
  intro: "You're all set. Here are the first three things to do.",
  quizTitle: "Answer the daily quiz",
  quizBlurb: "One World Cup trivia question every day.",
  quizCta: "Play today's quiz",
  groupsTitle: "Start or join a group",
  groupsBlurb: "Compete head-to-head with friends.",
  groupsCta: "Find your friends",
  leaderboardTitle: "Check the leaderboard",
  leaderboardBlurb: "See where you stand.",
  leaderboardCta: "View the leaderboard",
  footer: "You're getting this because you just joined the World Cup pool.",
};

function makeData(overrides: Partial<WelcomeEmailData> = {}): WelcomeEmailData {
  return {
    displayName: "Alex",
    quizUrl: "https://example.com/en/quiz",
    groupsUrl: "https://example.com/en/groups",
    leaderboardUrl: "https://example.com/en/leaderboard",
    strings: STRINGS,
    ...overrides,
  };
}

describe("renderWelcomeEmail", () => {
  it("returns subject/html/text without DB or network", () => {
    const out = renderWelcomeEmail(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("<!DOCTYPE html>");
    expect(typeof out.text).toBe("string");
  });

  it("orients the user to all three loops with deep links (HTML and text)", () => {
    const out = renderWelcomeEmail(makeData());
    for (const part of [out.html, out.text]) {
      expect(part).toContain(STRINGS.quizTitle);
      expect(part).toContain(STRINGS.groupsTitle);
      expect(part).toContain(STRINGS.leaderboardTitle);
      expect(part).toContain("https://example.com/en/quiz");
      expect(part).toContain("https://example.com/en/groups");
      expect(part).toContain("https://example.com/en/leaderboard");
    }
  });

  it("personalizes the heading when a display name is present", () => {
    const out = renderWelcomeEmail(makeData({ displayName: "Alex" }));
    expect(out.html).toContain("Welcome, Alex!");
    expect(out.text).toContain("Welcome, Alex!");
    expect(out.html).not.toContain("Welcome to the pool!");
  });

  it("uses the name-less heading variant when no display name", () => {
    const out = renderWelcomeEmail(makeData({ displayName: null }));
    expect(out.html).toContain("Welcome to the pool!");
    expect(out.text).toContain("Welcome to the pool!");
    expect(out.html).not.toContain("Welcome, Alex!");
  });

  it("uses email-safe styling — no oklch, CSS variables, or stylesheets", () => {
    const out = renderWelcomeEmail(makeData());
    expect(out.html).not.toMatch(/oklch/i);
    expect(out.html).not.toContain("var(--");
    expect(out.html).not.toContain("<link");
    expect(out.html).not.toContain("class=");
  });

  it("escapes HTML in copy to prevent injection", () => {
    const out = renderWelcomeEmail(
      makeData({ strings: { ...STRINGS, heading: "<script>alert(1)</script>" } }),
    );
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
  });
});

// ---------------------------------------------------------------------------
// buildWelcomeEmailStrings — pure copy assembly
// ---------------------------------------------------------------------------

import { buildWelcomeEmailStrings } from "@/lib/notifications/welcome-email";

describe("buildWelcomeEmailStrings", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  it("interpolates the display name into the heading", () => {
    const s = buildWelcomeEmailStrings(t, { displayName: "Alex" });
    expect(s.heading).toBe('heading:{"name":"Alex"}');
    expect(s.headingNoName).toBe("headingNoName");
  });

  it("falls back to the no-name heading when display name is null", () => {
    const s = buildWelcomeEmailStrings(t, { displayName: null });
    expect(s.heading).toBe("headingNoName");
  });
});

// ---------------------------------------------------------------------------
// sendWelcomeEmail — one-time guard, gating, best-effort behavior
// ---------------------------------------------------------------------------

const sendMock = vi.fn();
const updateEqMock = vi.fn();
const updateIsMock = vi.fn();
const getUserByIdMock = vi.fn();

let profileData: { display_name: string | null; welcome_email_sent_at: string | null } | null = {
  display_name: "Alex",
  welcome_email_sent_at: null,
};
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
    emails = { send: sendMock };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`unexpected from(${table})`);
      return {
        // select(...).eq(...).maybeSingle() — read the guard.
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: profileData, error: null }),
          }),
        }),
        // update(...).eq(...).is(...) — stamp the guard.
        update: (values: Record<string, unknown>) => {
          updateIsMock(values);
          return {
            eq: () => ({
              is: () => {
                updateEqMock();
                return Promise.resolve({ error: null });
              },
            }),
          };
        },
      };
    },
    auth: { admin: { getUserById: getUserByIdMock } },
  })),
}));

beforeEach(() => {
  sendMock.mockReset().mockResolvedValue({ data: { id: "email-1" }, error: null });
  updateEqMock.mockReset();
  updateIsMock.mockReset();
  getUserByIdMock
    .mockReset()
    .mockResolvedValue({ data: { user: { email: "player@player.dev" } }, error: null });
  profileData = { display_name: "Alex", welcome_email_sent_at: null };
  resendApiKey = "re_test";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("sendWelcomeEmail", () => {
  it("no-ops without sending when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { sendWelcomeEmail } = await import("@/lib/notifications/welcome-email");
    await sendWelcomeEmail("u1");
    expect(sendMock).not.toHaveBeenCalled();
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("sends once and stamps the guard only after the provider accepts", async () => {
    const { sendWelcomeEmail } = await import("@/lib/notifications/welcome-email");
    await sendWelcomeEmail("u1");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(updateIsMock).toHaveBeenCalledWith(
      expect.objectContaining({ welcome_email_sent_at: expect.any(String) }),
    );
    expect(updateEqMock).toHaveBeenCalledTimes(1);
  });

  it("does not send again when the guard is already set", async () => {
    profileData = { display_name: "Alex", welcome_email_sent_at: "2026-06-19T00:00:00Z" };
    const { sendWelcomeEmail } = await import("@/lib/notifications/welcome-email");
    await sendWelcomeEmail("u1");
    expect(sendMock).not.toHaveBeenCalled();
    expect(getUserByIdMock).not.toHaveBeenCalled();
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("leaves the guard null when the provider rejects the send", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const { sendWelcomeEmail } = await import("@/lib/notifications/welcome-email");
    await sendWelcomeEmail("u1");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("skips a recipient with no resolvable address", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
    const { sendWelcomeEmail } = await import("@/lib/notifications/welcome-email");
    await sendWelcomeEmail("u1");
    expect(sendMock).not.toHaveBeenCalled();
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("skips a recipient with an undeliverable (reserved-domain) address", async () => {
    getUserByIdMock.mockResolvedValue({
      data: { user: { email: "someone@example.com" } },
      error: null,
    });
    const { sendWelcomeEmail } = await import("@/lib/notifications/welcome-email");
    await sendWelcomeEmail("u1");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("never throws even if the provider throws", async () => {
    sendMock.mockRejectedValue(new Error("network down"));
    const { sendWelcomeEmail } = await import("@/lib/notifications/welcome-email");
    await expect(sendWelcomeEmail("u1")).resolves.toBeUndefined();
    expect(updateEqMock).not.toHaveBeenCalled();
  });
});
