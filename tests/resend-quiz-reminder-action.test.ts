import { beforeEach, describe, expect, it, vi } from "vitest";

// Guard + behavior tests for the resendQuizReminder server action: the admin
// gate must hold before any force-dispatch, a missing active question is a
// signposted no-op, and a successful run force-dispatches and redirects with the
// summary in query params.

const dispatchMock = vi.fn(async () => ({ emailed: 5, failed: 0, skipped: 1 }));
const getActiveBrandingMock = vi.fn(async () => ({ emailFromName: "World Cup Pools" }));
const getUserMock = vi.fn();
const profileSingleMock = vi.fn();
const questionMaybeSingleMock = vi.fn();

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
}));

vi.mock("@/lib/notifications/quiz-reminder-emails", () => ({
  dispatchQuizReminders: dispatchMock,
}));

vi.mock("@/lib/competition", () => ({
  getActiveBranding: getActiveBrandingMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({ select: () => ({ eq: () => ({ single: profileSingleMock }) }) }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: questionMaybeSingleMock }) }),
    }),
  }),
}));

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  dispatchMock.mockClear();
  getActiveBrandingMock.mockClear();
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "admin1" } } });
  profileSingleMock.mockReset().mockResolvedValue({ data: { is_admin: true } });
  questionMaybeSingleMock.mockReset().mockResolvedValue({ data: { id: "q1" }, error: null });
});

describe("resendQuizReminder action", () => {
  it("rejects a non-admin and sends nothing", async () => {
    profileSingleMock.mockResolvedValue({ data: { is_admin: false } });
    const { resendQuizReminder } = await import("@/app/[locale]/(admin)/admin/quiz/actions");
    await expect(resendQuizReminder(form({ locale: "en" }))).rejects.toThrow("Admin only");
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("signposts a no-op when there is no active question and sends nothing", async () => {
    questionMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { resendQuizReminder } = await import("@/app/[locale]/(admin)/admin/quiz/actions");
    await expect(resendQuizReminder(form({ locale: "en" }))).rejects.toThrow(
      /resendQuizNoQuestion=1/,
    );
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("force-dispatches for today's question and redirects with the summary", async () => {
    const { resendQuizReminder } = await import("@/app/[locale]/(admin)/admin/quiz/actions");
    await expect(resendQuizReminder(form({ locale: "en" }))).rejects.toThrow(
      /resendQuizEmailed=5.*resendQuizSkipped=1/,
    );
    expect(dispatchMock).toHaveBeenCalledWith("World Cup Pools", { force: true });
  });
});
