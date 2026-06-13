import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const updateEqMock = vi.fn();
const updateMock = vi.fn();
const rpcMock = vi.fn();
const assertMatchInManagedMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    siteUrl: "http://localhost:3000",
    footballDataToken: "t",
    cronSecret: "s",
  },
  requireServiceRoleKey: () => "service-role",
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin" } } })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { is_admin: true } })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: insertMock,
      update: updateMock,
    })),
    rpc: rpcMock,
  })),
}));

const MANAGED = {
  id: "comp-1",
  is_active: true,
  format: {
    stages: [
      { key: "group", kind: "group", order: 1, hasGroupCode: true, labels: { en: "G" } },
      { key: "final", kind: "knockout", order: 2, hasGroupCode: false, labels: { en: "F" } },
    ],
    groups: { enabled: true, pattern: "^[A-H]$", count: 8 },
  },
};

vi.mock("@/lib/admin/managed-competition", () => ({
  getManagedCompetition: vi.fn(async () => MANAGED),
  assertMatchInManaged: (...a: unknown[]) => assertMatchInManagedMock(...a),
}));

const MATCH_ID = "11111111-1111-4111-8111-111111111111";

function fixtureForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("stage", "group");
  fd.set("group_code", "A");
  fd.set("home_team", "Alpha");
  fd.set("away_team", "Beta");
  fd.set("kickoff_at", "2030-01-01T00:00");
  fd.set("venue", "Stadium");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.resetModules();
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
  updateEqMock.mockReset();
  updateEqMock.mockResolvedValue({ error: null });
  updateMock.mockReset();
  updateMock.mockReturnValue({ eq: updateEqMock });
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ error: null });
  assertMatchInManagedMock.mockReset();
  assertMatchInManagedMock.mockResolvedValue(undefined);
});

describe("saveFixture scoping", () => {
  it("stamps the managed competition_id on a new fixture", async () => {
    const { saveFixture } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await saveFixture(fixtureForm());
    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertMock.mock.calls[0][0]).toMatchObject({ competition_id: "comp-1" });
  });

  it("rejects a posted competition_id that is not the managed one", async () => {
    const { saveFixture } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await expect(
      saveFixture(fixtureForm({ competition_id: "other-comp" })),
    ).rejects.toThrow(/competition mismatch/i);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a stage that is not in the managed competition format", async () => {
    const { saveFixture } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await expect(saveFixture(fixtureForm({ stage: "r16" }))).rejects.toThrow();
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("cross-competition mutation guard", () => {
  it("setMatchResult rejects a match outside the managed competition", async () => {
    assertMatchInManagedMock.mockRejectedValueOnce(
      new Error("Match does not belong to the managed competition"),
    );
    const { setMatchResult } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    const fd = new FormData();
    fd.set("match_id", MATCH_ID);
    fd.set("home_score", "1");
    fd.set("away_score", "0");
    fd.set("status", "final");
    await expect(setMatchResult(fd)).rejects.toThrow(/managed competition/i);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("deleteMatch rejects a match outside the managed competition", async () => {
    assertMatchInManagedMock.mockRejectedValueOnce(
      new Error("Match does not belong to the managed competition"),
    );
    const { deleteMatch } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    const fd = new FormData();
    fd.set("id", MATCH_ID);
    await expect(deleteMatch(fd)).rejects.toThrow(/managed competition/i);
  });
});
