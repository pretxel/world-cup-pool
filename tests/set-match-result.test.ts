import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MATCH_ID = "11111111-1111-4111-8111-111111111111";

const rpcMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// actions.ts now also exports syncNow, whose import chain (result-sync core →
// providers) reads @/lib/env at module load; stub it so this suite stays
// independent of real env vars.
vi.mock("@/lib/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    siteUrl: "http://localhost:3000",
    footballDataToken: "test-token",
    cronSecret: "test-secret",
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "admin-user" } },
      })),
    },
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
      update: updateMock,
    })),
    rpc: rpcMock,
  })),
}));

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ error: null });

  eqMock.mockReset();
  eqMock.mockResolvedValue({ error: null });

  updateMock.mockReset();
  updateMock.mockImplementation(() => ({ eq: eqMock }));
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeFormData(overrides: Partial<Record<string, string>> = {}): FormData {
  const fd = new FormData();
  fd.set("match_id", MATCH_ID);
  fd.set("home_score", "2");
  fd.set("away_score", "1");
  fd.set("status", "final");
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) fd.delete(k);
    else fd.set(k, v);
  }
  return fd;
}

describe("setMatchResult", () => {
  it("calls compute_match_scores exactly once after the UPDATE on a final save", async () => {
    const { setMatchResult } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await setMatchResult(makeFormData());

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("compute_match_scores", {
      p_match_id: MATCH_ID,
    });
  });

  it("re-saving identical values still triggers the RPC", async () => {
    const { setMatchResult } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await setMatchResult(makeFormData());
    await setMatchResult(makeFormData());

    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("calls the RPC even when status is not final", async () => {
    const { setMatchResult } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await setMatchResult(makeFormData({ status: "scheduled" }));

    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("throws if the RPC returns an error", async () => {
    rpcMock.mockResolvedValueOnce({ error: { message: "scoring failed" } });
    const { setMatchResult } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );

    await expect(setMatchResult(makeFormData())).rejects.toThrow(
      "scoring failed",
    );
  });
});
