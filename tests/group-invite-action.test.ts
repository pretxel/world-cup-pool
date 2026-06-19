import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GROUP_ID = "22222222-2222-4222-8222-222222222222";

// --- server (caller-session) client mock -----------------------------------
// membership row, group row, profile row — toggled per test.
let membershipRow: { group_id: string } | null = { group_id: GROUP_ID };
let groupRow: { name: string; join_code: string } | null = {
  name: "Office Pool",
  join_code: "WC-ABCDE",
};
let userId: string | null = "me";

const serverFrom = vi.fn((table: string) => {
  if (table === "group_members") {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: membershipRow, error: null }),
          }),
        }),
      }),
    };
  }
  if (table === "groups") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: groupRow, error: null }),
        }),
      }),
    };
  }
  if (table === "profiles") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { display_name: "Alex" }, error: null }),
        }),
      }),
    };
  }
  throw new Error(`unexpected server from(${table})`);
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
    from: serverFrom,
  })),
}));

// --- admin (service-role) client mock — rate-limit counts ------------------
let inviterCount = 0;
let groupCount = 0;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: () => ({
      // select(...,{head,count}).eq(...).gte(...) — the .eq chain length varies
      // (inviter-only vs inviter+group), so return a thenable that resolves to
      // the right count based on how many .eq calls preceded .gte.
      select: () => {
        let eqCount = 0;
        const chain = {
          eq: () => {
            eqCount++;
            return chain;
          },
          gte: () =>
            Promise.resolve({
              count: eqCount >= 2 ? groupCount : inviterCount,
              error: null,
            }),
        };
        return chain;
      },
    }),
  })),
}));

// --- sender mock -----------------------------------------------------------
const sendMock =
  vi.fn<(opts: { recipients: string[] } & Record<string, unknown>) => Promise<{
    sent: number;
    failed: number;
    skipped: number;
  }>>();
vi.mock("@/lib/notifications/group-invite-email", () => ({
  sendGroupInviteEmails: sendMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

beforeEach(() => {
  membershipRow = { group_id: GROUP_ID };
  groupRow = { name: "Office Pool", join_code: "WC-ABCDE" };
  userId = "me";
  inviterCount = 0;
  groupCount = 0;
  sendMock.mockClear().mockResolvedValue({ sent: 1, failed: 0, skipped: 0 });
});

afterEach(() => {
  vi.clearAllMocks();
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  f.set("locale", "en");
  f.set("group_id", GROUP_ID);
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

async function importActions() {
  return import("@/app/[locale]/(app)/groups/actions");
}

describe("inviteToGroupByEmailAction", () => {
  it("rejects when no valid recipient is supplied", async () => {
    const { inviteToGroupByEmailAction } = await importActions();
    const res = await inviteToGroupByEmailAction({}, fd({ recipients: "not-an-email" }));
    expect(res.error).toBe("errorNoRecipients");
    expect(res.invalid).toContain("not-an-email");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects more than the per-submission recipient cap", async () => {
    const many = Array.from({ length: 11 }, (_, i) => `u${i}@gmail.com`).join(", ");
    const { inviteToGroupByEmailAction } = await importActions();
    const res = await inviteToGroupByEmailAction({}, fd({ recipients: many }));
    expect(res.error).toBe("errorTooMany");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("de-duplicates addresses differing by case/whitespace", async () => {
    const { inviteToGroupByEmailAction } = await importActions();
    await inviteToGroupByEmailAction(
      {},
      fd({ recipients: "  Friend@Gmail.com , friend@gmail.com" }),
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].recipients).toEqual(["friend@gmail.com"]);
  });

  it("rejects a non-member without sending", async () => {
    membershipRow = null;
    const { inviteToGroupByEmailAction } = await importActions();
    const res = await inviteToGroupByEmailAction({}, fd({ recipients: "a@gmail.com" }));
    expect(res.error).toBe("errorNotMember");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects a signed-out caller", async () => {
    userId = null;
    const { inviteToGroupByEmailAction } = await importActions();
    await expect(
      inviteToGroupByEmailAction({}, fd({ recipients: "a@gmail.com" })),
    ).rejects.toThrow("Not signed in");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects when the inviter is over the rolling-window limit", async () => {
    inviterCount = 50; // already at MAX_INVITES_PER_INVITER_PER_DAY
    const { inviteToGroupByEmailAction } = await importActions();
    const res = await inviteToGroupByEmailAction({}, fd({ recipients: "a@gmail.com" }));
    expect(res.error).toBe("errorRateLimited");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends to valid recipients and returns counts", async () => {
    const { inviteToGroupByEmailAction } = await importActions();
    const res = await inviteToGroupByEmailAction(
      {},
      fd({ recipients: "a@gmail.com, bad, b@gmail.com" }),
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].recipients).toEqual([
      "a@gmail.com",
      "b@gmail.com",
    ]);
    expect(res.sent).toBe(1);
    expect(res.invalid).toContain("bad");
  });
});
