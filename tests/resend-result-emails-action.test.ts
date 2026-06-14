import { beforeEach, describe, expect, it, vi } from "vitest";

// Guard-ordering tests for the resendResultEmails server action: admin gate,
// managed-competition scope, and the server-side final re-check must all hold
// before any email is force-dispatched.

const forceDispatchMock = vi.fn(async () => ({ emailed: 7, failed: 0, skipped: 1 }));
const assertMatchInManagedMock = vi.fn(async () => {});
const getManagedCompetitionMock = vi.fn(async () => ({ id: "comp1", is_active: true }));
const getUserMock = vi.fn();
const profileSingleMock = vi.fn();
const matchSingleMock = vi.fn();

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

vi.mock("@/lib/notifications/result-emails", () => ({
  forceDispatchResultEmails: forceDispatchMock,
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
  createAdminSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: matchSingleMock }) }) }),
  }),
}));

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  forceDispatchMock.mockClear();
  assertMatchInManagedMock.mockReset().mockResolvedValue(undefined);
  getManagedCompetitionMock.mockReset().mockResolvedValue({ id: "comp1", is_active: true });
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "admin1" } } });
  profileSingleMock.mockReset().mockResolvedValue({ data: { is_admin: true } });
  matchSingleMock.mockReset().mockResolvedValue({ data: { status: "final" }, error: null });
});

describe("resendResultEmails action", () => {
  it("rejects a non-admin and sends nothing", async () => {
    profileSingleMock.mockResolvedValue({ data: { is_admin: false } });
    const { resendResultEmails } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await expect(
      resendResultEmails(form({ match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow("Admin only");
    expect(forceDispatchMock).not.toHaveBeenCalled();
  });

  it("rejects a match outside the managed competition and sends nothing", async () => {
    assertMatchInManagedMock.mockRejectedValue(new Error("Match not in managed competition"));
    const { resendResultEmails } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await expect(
      resendResultEmails(form({ match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow("managed");
    expect(forceDispatchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-final match server-side and sends nothing", async () => {
    matchSingleMock.mockResolvedValue({ data: { status: "scheduled" }, error: null });
    const { resendResultEmails } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await expect(
      resendResultEmails(form({ match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/resendError=notFinal/);
    expect(forceDispatchMock).not.toHaveBeenCalled();
  });

  it("force-dispatches for a final match and redirects with the summary", async () => {
    const { resendResultEmails } = await import(
      "@/app/[locale]/(admin)/admin/matches/actions"
    );
    await expect(
      resendResultEmails(form({ match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/resendEmailed=7.*resendSkipped=1/);
    expect(forceDispatchMock).toHaveBeenCalledWith(MATCH_ID);
  });
});
