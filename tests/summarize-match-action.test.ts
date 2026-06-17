import { beforeEach, describe, expect, it, vi } from "vitest";

// Guard-ordering + outcome tests for the summarizeMatch server action: the admin
// gate and managed-competition scope must hold before the generator runs, and
// the generator's result (or a thrown error) must be surfaced via the redirect's
// query params rather than producing a server-error page.

const generateMatchSummaryMock = vi.fn(async () => ({ generated: true }) as {
  generated: boolean;
  reason?: string;
});
const assertMatchInManagedMock = vi.fn(async () => {});
const getManagedCompetitionMock = vi.fn(async () => ({ id: "comp1", is_active: true }));
const getUserMock = vi.fn();
const profileSingleMock = vi.fn();

const MATCH_ID = "11111111-1111-4111-8111-111111111111";

// redirect() throws NEXT_REDIRECT in Next; emulate so we can assert the target.
class RedirectError extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/result-sync/core", () => ({ runSync: vi.fn() }));
vi.mock("@/lib/matches/match-image-prompt", () => ({
  generateMatchImagePrompt: vi.fn(async () => ({ generated: true })),
}));
vi.mock("@/lib/matches/match-image-render", () => ({
  requestMatchImageRender: vi.fn(async () => ({ requested: true })),
  pollMatchImageRender: vi.fn(async () => ({ polled: true })),
}));

vi.mock("@/lib/notifications/result-emails", () => ({
  forceDispatchResultEmails: vi.fn(),
}));

vi.mock("@/lib/matches/match-summary", () => ({
  generateMatchSummary: generateMatchSummaryMock,
}));

vi.mock("@/lib/admin/managed-competition", () => ({
  getManagedCompetition: getManagedCompetitionMock,
  assertMatchInManaged: assertMatchInManagedMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({ select: () => ({ eq: () => ({ single: profileSingleMock }) }) }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({ from: vi.fn() }),
}));

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  generateMatchSummaryMock.mockReset().mockResolvedValue({ generated: true });
  assertMatchInManagedMock.mockReset().mockResolvedValue(undefined);
  getManagedCompetitionMock.mockReset().mockResolvedValue({ id: "comp1", is_active: true });
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "admin1" } } });
  profileSingleMock.mockReset().mockResolvedValue({ data: { is_admin: true } });
});

describe("summarizeMatch action", () => {
  it("rejects a non-admin and never generates", async () => {
    profileSingleMock.mockResolvedValue({ data: { is_admin: false } });
    const { summarizeMatch } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await expect(
      summarizeMatch(form({ match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow("Admin only");
    expect(generateMatchSummaryMock).not.toHaveBeenCalled();
  });

  it("rejects a match outside the managed competition and never generates", async () => {
    assertMatchInManagedMock.mockRejectedValue(new Error("Match does not belong to the managed competition"));
    const { summarizeMatch } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await expect(
      summarizeMatch(form({ match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow("managed");
    expect(generateMatchSummaryMock).not.toHaveBeenCalled();
  });

  it("surfaces a no-events skip via the redirect params", async () => {
    generateMatchSummaryMock.mockResolvedValue({ generated: false, reason: "no-events" });
    const { summarizeMatch } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await expect(
      summarizeMatch(form({ match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/summaryMatchId=.*summaryReason=no-events/);
    expect(generateMatchSummaryMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a successful generation via the redirect params", async () => {
    const { summarizeMatch } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await expect(
      summarizeMatch(form({ match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/summaryReason=generated/);
  });

  it("maps a thrown generator error to an error outcome, not a server error", async () => {
    generateMatchSummaryMock.mockRejectedValue(new Error("openrouter down"));
    const { summarizeMatch } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    // The action catches the throw and still redirects (with reason=error).
    await expect(
      summarizeMatch(form({ match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/summaryReason=error/);
    expect(generateMatchSummaryMock).toHaveBeenCalledTimes(1);
  });
});
