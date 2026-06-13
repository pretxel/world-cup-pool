import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunSummary } from "@/lib/result-sync/types";

const redirectMock = vi.fn();
const runSyncMock = vi.fn();
const revalidatePathMock = vi.fn();
const revalidateTagMock = vi.fn();
let isAdmin = true;

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

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
      getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { is_admin: isAdmin } })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({})),
}));

// Managed-competition context reads cookies; stub it (active scope).
vi.mock("@/lib/admin/managed-competition", () => ({
  getManagedCompetition: vi.fn(async () => ({ id: "comp-1", is_active: true })),
  assertMatchInManaged: vi.fn(async () => {}),
}));

vi.mock("@/lib/result-sync/core", () => ({
  runSync: (...args: unknown[]) => runSyncMock(...args),
}));

function summary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    fetched: 10,
    matched: 8,
    live: 1,
    final: 2,
    recomputed: 3,
    unmatched: 2,
    errors: 0,
    source: "football-data",
    stale: 0,
    staleResolved: 1,
    ...overrides,
  };
}

function makeFormData(locale?: string): FormData {
  const fd = new FormData();
  if (locale) fd.set("locale", locale);
  return fd;
}

beforeEach(() => {
  redirectMock.mockReset();
  runSyncMock.mockReset();
  revalidatePathMock.mockReset();
  revalidateTagMock.mockReset();
  isAdmin = true;
});

describe("syncNow", () => {
  it("runs the sync and redirects back with the summary in query params", async () => {
    runSyncMock.mockResolvedValue(summary());
    const { syncNow } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );

    await syncNow(makeFormData("es"));

    expect(runSyncMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledTimes(1);
    const target = String(redirectMock.mock.calls[0][0]);
    expect(target).toMatch(/^\/es\/admin\/matches\?/);
    const params = new URLSearchParams(target.split("?")[1]);
    expect(params.get("syncSource")).toBe("football-data");
    expect(params.get("syncMatched")).toBe("8");
    expect(params.get("syncFinal")).toBe("2");
    expect(params.get("syncStale")).toBe("0");
    expect(params.get("syncStaleResolved")).toBe("1");
    expect(params.get("syncErrors")).toBe("0");
    expect(revalidatePathMock).toHaveBeenCalledWith("/matches");
    expect(revalidatePathMock).toHaveBeenCalledWith("/leaderboard");
  });

  it("surfaces a total failure as syncSource=none instead of silent success", async () => {
    runSyncMock.mockResolvedValue(summary({ source: "none", errors: 2 }));
    const { syncNow } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );

    await syncNow(makeFormData("en"));

    const target = String(redirectMock.mock.calls[0][0]);
    const params = new URLSearchParams(target.split("?")[1]);
    expect(params.get("syncSource")).toBe("none");
    expect(params.get("syncErrors")).toBe("2");
  });

  it("falls back to the default locale for a bogus locale value", async () => {
    runSyncMock.mockResolvedValue(summary());
    const { syncNow } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );

    await syncNow(makeFormData("zz"));
    expect(String(redirectMock.mock.calls[0][0])).toMatch(
      /^\/en\/admin\/matches\?/,
    );
  });

  it("rejects non-admins before running anything", async () => {
    isAdmin = false;
    const { syncNow } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );

    await expect(syncNow(makeFormData("en"))).rejects.toThrow("Admin only");
    expect(runSyncMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
