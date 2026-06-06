import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

const rpcMock = vi.fn();
const updateEqMock = vi.fn();
const deleteEqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // Mirror Next's real behavior: redirect() throws control flow.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "me" } } })),
    },
    rpc: rpcMock,
    from: vi.fn(() => ({ update: updateMock, delete: deleteMock })),
  })),
}));

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: GROUP_ID, error: null });
  updateEqMock.mockReset();
  updateEqMock.mockResolvedValue({ error: null });
  deleteEqMock.mockReset();
  deleteEqMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  f.set("locale", "en");
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

async function importActions() {
  return import("@/app/[locale]/(app)/groups/actions");
}

describe("createGroupAction", () => {
  it("rejects a too-short name without calling the RPC", async () => {
    const { createGroupAction } = await importActions();
    const result = await createGroupAction({}, fd({ name: "x" }));
    expect(result).toEqual({ error: "errorInvalidName" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("creates with a trimmed name then redirects to the new group", async () => {
    const { createGroupAction } = await importActions();
    await expect(
      createGroupAction({}, fd({ name: "  Office Pool  " })),
    ).rejects.toThrow(`REDIRECT:/en/groups/${GROUP_ID}`);
    expect(rpcMock).toHaveBeenCalledWith("create_group", {
      p_name: "Office Pool",
    });
  });
});

describe("joinGroupAction", () => {
  it("rejects an empty code without calling the RPC", async () => {
    const { joinGroupAction } = await importActions();
    const result = await joinGroupAction({}, fd({ code: "" }));
    expect(result).toEqual({ error: "errorInvalidCode" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("maps an invalid-code RPC error to errorInvalidCode", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "invalid join code" },
    });
    const { joinGroupAction } = await importActions();
    const result = await joinGroupAction({}, fd({ code: "WC-ZZZZZ" }));
    expect(result).toEqual({ error: "errorInvalidCode" });
    expect(rpcMock).toHaveBeenCalledWith("join_group", { p_code: "WC-ZZZZZ" });
  });

  it("maps an unexpected RPC error to errorGeneric", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "deadlock detected" },
    });
    const { joinGroupAction } = await importActions();
    const result = await joinGroupAction({}, fd({ code: "WC-ABCDE" }));
    expect(result).toEqual({ error: "errorGeneric" });
  });

  it("redirects to the group on a successful join", async () => {
    const { joinGroupAction } = await importActions();
    await expect(
      joinGroupAction({}, fd({ code: "WC-ABCDE" })),
    ).rejects.toThrow(`REDIRECT:/en/groups/${GROUP_ID}`);
    expect(rpcMock).toHaveBeenCalledWith("join_group", { p_code: "WC-ABCDE" });
  });
});

describe("leaveGroupAction", () => {
  it("calls leave_group and redirects back to the groups list", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const { leaveGroupAction } = await importActions();
    await expect(
      leaveGroupAction(fd({ group_id: GROUP_ID })),
    ).rejects.toThrow("REDIRECT:/en/groups");
    expect(rpcMock).toHaveBeenCalledWith("leave_group", {
      p_group_id: GROUP_ID,
    });
  });
});

describe("removeMemberAction", () => {
  it("calls remove_group_member with the group and target user", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const { removeMemberAction } = await importActions();
    await removeMemberAction(fd({ group_id: GROUP_ID, user_id: USER_ID }));
    expect(rpcMock).toHaveBeenCalledWith("remove_group_member", {
      p_group_id: GROUP_ID,
      p_user_id: USER_ID,
    });
  });
});
