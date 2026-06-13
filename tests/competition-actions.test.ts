import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePathMock = vi.fn();
const revalidateTagMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePathMock(...a),
  revalidateTag: (...a: unknown[]) => revalidateTagMock(...a),
}));
vi.mock("next/navigation", () => ({
  redirect: (...a: unknown[]) => redirectMock(...a),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() })),
}));
vi.mock("@/lib/env", () => ({
  env: { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" },
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

// Controllable admin client.
const state: {
  insertPayload: Record<string, unknown> | null;
  competitionRow: Record<string, unknown> | null;
  matchCount: number;
  groupCount: number;
  deleted: boolean;
} = {
  insertPayload: null,
  competitionRow: null,
  matchCount: 0,
  groupCount: 0,
  deleted: false,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "competitions") {
        const q: Record<string, unknown> = {
          insert: (payload: Record<string, unknown>) => {
            state.insertPayload = payload;
            return {
              select: () => ({
                single: async () => ({ data: { id: "new-id" }, error: null }),
              }),
            };
          },
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: state.competitionRow, error: null }),
          delete: () => ({
            eq: async () => {
              state.deleted = true;
              return { error: null };
            },
          }),
        };
        return q;
      }
      if (table === "matches") {
        return { select: () => ({ eq: async () => ({ count: state.matchCount, error: null }) }) };
      }
      if (table === "groups") {
        return { select: () => ({ eq: async () => ({ count: state.groupCount, error: null }) }) };
      }
      throw new Error(`unexpected from(${table})`);
    },
    rpc: vi.fn(async () => ({ error: null })),
  })),
}));

function validCreateForm(): FormData {
  const fd = new FormData();
  fd.set("locale", "en");
  fd.set("slug", "champions-league-2027");
  fd.set("kind", "champions_league");
  fd.set("name", "Champions League 2027");
  fd.set("short_name", "UCL 2027");
  fd.set("tournament_start_at", "2027-09-01T18:00");
  fd.set(
    "format_config",
    JSON.stringify({
      stages: [{ key: "league", kind: "league", order: 1, labels: { en: "League" } }],
      groups: { enabled: false },
    }),
  );
  fd.set("providers", "{}");
  fd.set("branding", "{}");
  return fd;
}

beforeEach(() => {
  vi.resetModules();
  revalidatePathMock.mockReset();
  redirectMock.mockReset();
  state.insertPayload = null;
  state.competitionRow = null;
  state.matchCount = 0;
  state.groupCount = 0;
  state.deleted = false;
});

describe("createCompetition", () => {
  it("forces is_active=false on insert and redirects to the edit page", async () => {
    const { createCompetition } = await import(
      "@/app/[locale]/(admin)/admin/competitions/actions"
    );
    await createCompetition(validCreateForm());
    expect(state.insertPayload).not.toBeNull();
    expect(state.insertPayload!.is_active).toBe(false);
    expect(redirectMock).toHaveBeenCalledOnce();
  });
});

describe("deleteCompetition guardrails", () => {
  function form(id = "11111111-1111-4111-8111-111111111111") {
    const fd = new FormData();
    fd.set("id", id);
    return fd;
  }

  it("refuses to delete the active competition", async () => {
    state.competitionRow = { slug: "euro-2028", is_active: true };
    const { deleteCompetition } = await import(
      "@/app/[locale]/(admin)/admin/competitions/actions"
    );
    await expect(deleteCompetition(form())).rejects.toThrow(/switch the active/i);
    expect(state.deleted).toBe(false);
  });

  it("refuses to delete the World Cup 2026 seed", async () => {
    state.competitionRow = { slug: "world-cup-2026", is_active: false };
    const { deleteCompetition } = await import(
      "@/app/[locale]/(admin)/admin/competitions/actions"
    );
    await expect(deleteCompetition(form())).rejects.toThrow(/seed/i);
    expect(state.deleted).toBe(false);
  });

  it("refuses to delete a competition with fixtures", async () => {
    state.competitionRow = { slug: "euro-2028", is_active: false };
    state.matchCount = 12;
    const { deleteCompetition } = await import(
      "@/app/[locale]/(admin)/admin/competitions/actions"
    );
    await expect(deleteCompetition(form())).rejects.toThrow(/cannot delete/i);
    expect(state.deleted).toBe(false);
  });

  it("deletes an empty, non-active, non-seed competition", async () => {
    state.competitionRow = { slug: "euro-2028", is_active: false };
    state.matchCount = 0;
    state.groupCount = 0;
    const { deleteCompetition } = await import(
      "@/app/[locale]/(admin)/admin/competitions/actions"
    );
    await deleteCompetition(form());
    expect(state.deleted).toBe(true);
  });
});
