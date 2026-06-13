import { beforeEach, describe, expect, it, vi } from "vitest";

// A controllable cookie store.
const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    siteUrl: "http://localhost:3000",
  },
  requireServiceRoleKey: () => "service-role",
}));

// Competitions dataset, queried by the admin client mock.
const byId = new Map<string, Record<string, unknown>>();
let activeRow: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: (table: string) => {
      if (table !== "competitions") throw new Error(`unexpected from(${table})`);
      const filter: Record<string, unknown> = {};
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          filter[col] = val;
          return q;
        },
        maybeSingle: async () => {
          if ("id" in filter) {
            return { data: byId.get(filter.id as string) ?? null, error: null };
          }
          if ("is_active" in filter) return { data: activeRow, error: null };
          return { data: null, error: null };
        },
      };
      return q;
    },
  })),
}));

function competition(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: "world-cup-2026",
    kind: "world_cup",
    name: `Competition ${id}`,
    short_name: "WC",
    season: "2026",
    tournament_start_at: "2026-06-11T19:00:00Z",
    tournament_end_at: null,
    opening_home: null,
    opening_away: null,
    opening_venue: null,
    is_active: false,
    format_config: {
      stages: [{ key: "final", kind: "knockout", order: 1, labels: { en: "Final" } }],
      groups: { enabled: false },
    },
    providers: {},
    branding: {},
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
  cookieStore.get.mockReset();
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  byId.clear();
  activeRow = null;
});

describe("getManagedCompetition", () => {
  it("defaults to the active competition when no cookie is set", async () => {
    cookieStore.get.mockReturnValue(undefined);
    activeRow = competition("active-id", { is_active: true });

    const { getManagedCompetition } = await import("@/lib/admin/managed-competition");
    const managed = await getManagedCompetition();
    expect(managed?.id).toBe("active-id");
  });

  it("returns the cookie's competition when it exists (may be non-active)", async () => {
    cookieStore.get.mockReturnValue({ value: "draft-id" });
    byId.set("draft-id", competition("draft-id", { is_active: false }));
    activeRow = competition("active-id", { is_active: true });

    const { getManagedCompetition } = await import("@/lib/admin/managed-competition");
    const managed = await getManagedCompetition();
    expect(managed?.id).toBe("draft-id");
  });

  it("falls back to active and clears a stale cookie pointing at a deleted competition", async () => {
    cookieStore.get.mockReturnValue({ value: "gone-id" });
    // byId has no "gone-id"
    activeRow = competition("active-id", { is_active: true });

    const { getManagedCompetition } = await import("@/lib/admin/managed-competition");
    const managed = await getManagedCompetition();
    expect(managed?.id).toBe("active-id");
    expect(cookieStore.delete).toHaveBeenCalledWith("wcp_admin_managed_competition");
  });

  it("returns null when there is no cookie and no active competition", async () => {
    cookieStore.get.mockReturnValue(undefined);
    activeRow = null;

    const { getManagedCompetition } = await import("@/lib/admin/managed-competition");
    expect(await getManagedCompetition()).toBeNull();
  });
});
