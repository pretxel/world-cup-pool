import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderGroupInviteEmail,
  type GroupInviteEmailData,
  type GroupInviteEmailStrings,
} from "@/lib/notifications/group-invite-template";

// ---------------------------------------------------------------------------
// renderGroupInviteEmail — pure renderer
// ---------------------------------------------------------------------------

const STRINGS: GroupInviteEmailStrings = {
  subject: "Alex invited you to join Office Pool",
  preheader: "Tap the link to join Office Pool and start competing.",
  eyebrow: "Group invite",
  heading: "Join Office Pool",
  intro: "Alex invited you to Office Pool on the World Cup Pool.",
  joinCta: "Join the group",
  footer: "You're getting this because someone invited you to a group.",
};

function makeData(overrides: Partial<GroupInviteEmailData> = {}): GroupInviteEmailData {
  return {
    inviterName: "Alex",
    groupName: "Office Pool",
    joinUrl: "https://example.com/en/groups/join/WC-ABCDE",
    strings: STRINGS,
    ...overrides,
  };
}

describe("renderGroupInviteEmail", () => {
  it("returns subject/html/text without DB or network", () => {
    const out = renderGroupInviteEmail(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("<!DOCTYPE html>");
    expect(typeof out.text).toBe("string");
  });

  it("includes the inviter, group, and join link in both HTML and text", () => {
    const out = renderGroupInviteEmail(makeData());
    for (const part of [out.html, out.text]) {
      // Inviter + group names ride in the resolved copy strings.
      expect(part).toContain("Office Pool");
      expect(part).toContain("Alex invited you to Office Pool");
      expect(part).toContain("https://example.com/en/groups/join/WC-ABCDE");
    }
  });

  it("uses email-safe styling — no oklch, CSS variables, or stylesheets", () => {
    const out = renderGroupInviteEmail(makeData());
    expect(out.html).not.toMatch(/oklch/i);
    expect(out.html).not.toContain("var(--");
    expect(out.html).not.toContain("<link");
    expect(out.html).not.toContain("class=");
  });

  it("escapes HTML in copy to prevent injection", () => {
    const out = renderGroupInviteEmail(
      makeData({ strings: { ...STRINGS, heading: "<script>alert(1)</script>" } }),
    );
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
  });
});

// ---------------------------------------------------------------------------
// buildGroupInviteEmailStrings — pure copy assembly
// ---------------------------------------------------------------------------

import { buildGroupInviteEmailStrings } from "@/lib/notifications/group-invite-email";

describe("buildGroupInviteEmailStrings", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  it("interpolates the inviter and group into the value-bearing copy", () => {
    const s = buildGroupInviteEmailStrings(t, {
      inviterName: "Alex",
      groupName: "Office Pool",
    });
    expect(s.subject).toBe('subject:{"inviter":"Alex","group":"Office Pool"}');
    expect(s.heading).toBe('heading:{"group":"Office Pool"}');
    expect(s.joinCta).toBe("joinCta");
  });
});

// ---------------------------------------------------------------------------
// sendGroupInviteEmails — gating, best-effort behavior, ledger writes
// ---------------------------------------------------------------------------

const sendMock = vi.fn();
const insertMock = vi.fn();

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
      if (table !== "group_invite_log") throw new Error(`unexpected from(${table})`);
      return {
        insert: (row: Record<string, unknown>) => {
          insertMock(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  })),
}));

beforeEach(() => {
  sendMock.mockReset().mockResolvedValue({ data: { id: "email-1" }, error: null });
  insertMock.mockReset();
  resendApiKey = "re_test";
});

afterEach(() => {
  vi.clearAllMocks();
});

const baseOpts = {
  groupId: "g1",
  groupName: "Office Pool",
  inviterId: "u1",
  inviterName: "Alex",
  joinCode: "WC-ABCDE",
  locale: "en" as const,
};

describe("sendGroupInviteEmails", () => {
  it("no-ops without sending when RESEND_API_KEY is unset", async () => {
    resendApiKey = null;
    const { sendGroupInviteEmails } = await import(
      "@/lib/notifications/group-invite-email"
    );
    const res = await sendGroupInviteEmails({
      ...baseOpts,
      recipients: ["friend@gmail.com"],
    });
    expect(sendMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(res).toEqual({ sent: 0, failed: 0, skipped: 1 });
  });

  it("sends one message per recipient and logs each accepted send", async () => {
    const { sendGroupInviteEmails } = await import(
      "@/lib/notifications/group-invite-email"
    );
    const res = await sendGroupInviteEmails({
      ...baseOpts,
      recipients: ["a@gmail.com", "b@gmail.com"],
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: "g1",
        inviter_id: "u1",
        recipient_email: "a@gmail.com",
      }),
    );
    expect(res).toEqual({ sent: 2, failed: 0, skipped: 0 });
  });

  it("counts a rejected recipient as failed without aborting the rest", async () => {
    sendMock
      .mockResolvedValueOnce({ data: null, error: { message: "rejected" } })
      .mockResolvedValueOnce({ data: { id: "ok" }, error: null });
    const { sendGroupInviteEmails } = await import(
      "@/lib/notifications/group-invite-email"
    );
    const res = await sendGroupInviteEmails({
      ...baseOpts,
      recipients: ["bad@gmail.com", "good@gmail.com"],
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(insertMock).toHaveBeenCalledTimes(1); // only the accepted send
    expect(res).toEqual({ sent: 1, failed: 1, skipped: 0 });
  });

  it("builds the join URL at the given locale", async () => {
    const { sendGroupInviteEmails } = await import(
      "@/lib/notifications/group-invite-email"
    );
    await sendGroupInviteEmails({
      ...baseOpts,
      locale: "es",
      recipients: ["friend@gmail.com"],
    });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.html).toContain("https://example.com/es/groups/join/WC-ABCDE");
  });
});
