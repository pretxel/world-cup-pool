import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted so the mock factories (lifted above imports) can reference them
// while the statically-imported actions module loads.
const h = vi.hoisted(() => ({
  setOperationEnabledMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(),
  isAdmin: true,
  user: { id: "u1" } as { id: string } | null,
}));

vi.mock("next/cache", () => ({
  revalidatePath: h.revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: h.redirectMock,
}));

// actions.ts imports every job library (result-sync, all the notification
// dispatchers, news-sync), whose import chains read env at module load; stub
// them so this suite stays independent of real env vars. Only the toggle
// action is exercised here, so plain vi.fn() bodies suffice.
vi.mock("@/lib/env", () => ({
  env: { supabaseUrl: "https://example.supabase.co" },
  requireServiceRoleKey: () => "service-role-key",
}));
vi.mock("@/lib/result-sync/core", () => ({ runSync: vi.fn() }));
vi.mock("@/lib/notifications/result-emails", () => ({ dispatchResultEmails: vi.fn() }));
vi.mock("@/lib/notifications/prediction-reminder-emails", () => ({
  dispatchPredictionReminders: vi.fn(),
}));
vi.mock("@/lib/notifications/quiz-reminder-emails", () => ({ dispatchQuizReminders: vi.fn() }));
vi.mock("@/lib/notifications/results-digest-emails", () => ({ dispatchResultsDigest: vi.fn() }));
vi.mock("@/lib/notifications/recap-digest-emails", () => ({ dispatchRecapDigest: vi.fn() }));
vi.mock("@/lib/notifications/comeback-emails", () => ({ dispatchComebackEmails: vi.fn() }));
vi.mock("@/lib/notifications/playoff-score-emails", () => ({ dispatchPlayoffScoreEmail: vi.fn() }));
vi.mock("@/lib/notifications/score-rules-emails", () => ({ dispatchScoreRulesEmail: vi.fn() }));
vi.mock("@/lib/news-sync", () => ({ runNewsSync: vi.fn() }));
vi.mock("@/lib/competition", () => ({ getActiveBranding: vi.fn() }));

vi.mock("@/lib/operations/settings", () => ({
  setOperationEnabled: h.setOperationEnabledMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: h.user } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { is_admin: h.isAdmin } })),
        })),
      })),
    })),
  })),
}));

import { toggleOperationEnabled } from "@/app/[locale]/(admin)/admin/operations/actions";

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.setOperationEnabledMock.mockReset().mockResolvedValue(undefined);
  h.revalidatePathMock.mockReset();
  h.redirectMock.mockReset();
  h.isAdmin = true;
  h.user = { id: "u1" };
});

describe("toggleOperationEnabled", () => {
  it("persists the switch, revalidates, and redirects back for an admin", async () => {
    await toggleOperationEnabled(
      makeFormData({ locale: "en", kind: "sync_news", enabled: "false" }),
    );
    expect(h.setOperationEnabledMock).toHaveBeenCalledWith("sync_news", false);
    expect(h.revalidatePathMock).toHaveBeenCalledWith("/admin/operations");
    expect(h.redirectMock).toHaveBeenCalled();
  });

  it("re-enables when the form asks for enabled=true", async () => {
    await toggleOperationEnabled(
      makeFormData({ locale: "en", kind: "sync_news", enabled: "true" }),
    );
    expect(h.setOperationEnabledMock).toHaveBeenCalledWith("sync_news", true);
  });

  it("rejects a non-admin and writes nothing", async () => {
    h.isAdmin = false;
    await expect(
      toggleOperationEnabled(
        makeFormData({ locale: "en", kind: "sync_news", enabled: "false" }),
      ),
    ).rejects.toThrow("Admin only");
    expect(h.setOperationEnabledMock).not.toHaveBeenCalled();
    expect(h.redirectMock).not.toHaveBeenCalled();
  });

  it("rejects a signed-out caller and writes nothing", async () => {
    h.user = null;
    await expect(
      toggleOperationEnabled(
        makeFormData({ locale: "en", kind: "sync_news", enabled: "false" }),
      ),
    ).rejects.toThrow("Not signed in");
    expect(h.setOperationEnabledMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown kind and writes nothing", async () => {
    await expect(
      toggleOperationEnabled(
        makeFormData({ locale: "en", kind: "drop_tables", enabled: "false" }),
      ),
    ).rejects.toThrow("Unknown operation kind");
    expect(h.setOperationEnabledMock).not.toHaveBeenCalled();
  });
});
