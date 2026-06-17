import { beforeEach, describe, expect, it, vi } from "vitest";

// Guard-ordering + outcome tests for the recap-versioning admin actions
// (regenerateMatchSummary, setActiveSummaryVersion, deleteSummaryVersion): the
// admin gate and managed scope hold before any DB work, and every outcome (incl.
// thrown errors and the delete-active guard) is surfaced via the redirect's
// query params rather than a server-error page.

const generateMatchSummaryMock = vi.fn(async () => ({ generated: true }) as {
  generated: boolean;
  reason?: string;
  summaryId?: string;
});
const generateImagePromptMock = vi.fn(async () => ({ generated: true }) as {
  generated: boolean;
  reason?: string;
});
const requestRenderMock = vi.fn(async () => ({ requested: true }) as {
  requested: boolean;
  reason?: string;
});
const pollRenderMock = vi.fn(async () => ({ polled: true }) as {
  polled: boolean;
  reason?: string;
});
const assertMatchInManagedMock = vi.fn(async () => {});
const getManagedCompetitionMock = vi.fn(async () => ({ id: "comp1", is_active: true }));
const getUserMock = vi.fn();
const profileSingleMock = vi.fn();

const holder = vi.hoisted(() => ({ admin: null as unknown }));

const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const SUMMARY_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_MATCH_ID = "33333333-3333-4333-8333-333333333333";

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
  generateMatchImagePrompt: generateImagePromptMock,
}));
vi.mock("@/lib/matches/match-image-render", () => ({
  requestMatchImageRender: requestRenderMock,
  pollMatchImageRender: pollRenderMock,
}));
vi.mock("@/lib/notifications/result-emails", () => ({
  forceDispatchResultEmails: vi.fn(),
}));

vi.mock("@/lib/matches/match-summary", () => ({
  generateMatchSummary: generateMatchSummaryMock,
  STYLE_PRESETS: { neutral: "", dramatic: "DRAMA", tactical: "TACTICS", concise: "CONCISE" },
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
  createAdminSupabaseClient: () => holder.admin,
}));

// Configurable service-role mock covering the chains the recap actions use:
//  select().eq().maybeSingle()  → the version row
//  update(payload).eq()         → resolves { error }  (tracked in updatePayloads)
//  delete().eq()                → resolves { error }
function makeAdmin(opts: {
  version?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
  deleteError?: { message: string } | null;
} = {}) {
  const updatePayloads: Record<string, unknown>[] = [];
  const deleteEq = vi.fn(async () => ({ error: opts.deleteError ?? null }));
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: opts.version ?? null, error: null }),
      }),
    }),
    update: (payload: Record<string, unknown>) => {
      updatePayloads.push(payload);
      return { eq: async () => ({ error: opts.updateError ?? null }) };
    },
    delete: () => ({ eq: deleteEq }),
  }));
  return { from, updatePayloads, deleteEq };
}

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

async function importActions() {
  return import("@/app/[locale]/(admin)/admin/matches/actions");
}

beforeEach(() => {
  generateMatchSummaryMock.mockReset().mockResolvedValue({ generated: true, summaryId: "s-new" });
  generateImagePromptMock.mockReset().mockResolvedValue({ generated: true });
  requestRenderMock.mockReset().mockResolvedValue({ requested: true });
  pollRenderMock.mockReset().mockResolvedValue({ polled: true });
  assertMatchInManagedMock.mockReset().mockResolvedValue(undefined);
  getManagedCompetitionMock.mockReset().mockResolvedValue({ id: "comp1", is_active: true });
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "admin1" } } });
  profileSingleMock.mockReset().mockResolvedValue({ data: { is_admin: true } });
  holder.admin = makeAdmin();
});

describe("regenerateMatchSummary action", () => {
  it("rejects a non-admin and never generates", async () => {
    profileSingleMock.mockResolvedValue({ data: { is_admin: false } });
    const { regenerateMatchSummary } = await importActions();
    await expect(
      regenerateMatchSummary(form({ match_id: MATCH_ID, locale: "en", style_key: "neutral" })),
    ).rejects.toThrow("Admin only");
    expect(generateMatchSummaryMock).not.toHaveBeenCalled();
  });

  it("rejects a match outside the managed competition", async () => {
    assertMatchInManagedMock.mockRejectedValue(new Error("Match does not belong to the managed competition"));
    const { regenerateMatchSummary } = await importActions();
    await expect(
      regenerateMatchSummary(form({ match_id: MATCH_ID, locale: "en", style_key: "neutral" })),
    ).rejects.toThrow("managed");
    expect(generateMatchSummaryMock).not.toHaveBeenCalled();
  });

  it("regenerates with a preset style and surfaces success via redirect params", async () => {
    const { regenerateMatchSummary } = await importActions();
    await expect(
      regenerateMatchSummary(form({ match_id: MATCH_ID, locale: "en", style_key: "dramatic" })),
    ).rejects.toThrow(/regenMatchId=.*regenResult=generated/);
    expect(generateMatchSummaryMock).toHaveBeenCalledWith(
      expect.anything(),
      MATCH_ID,
      { mode: "regenerate", style: { key: "dramatic", instruction: "DRAMA" } },
    );
  });

  it("passes the free-text instruction for a custom style", async () => {
    const { regenerateMatchSummary } = await importActions();
    await expect(
      regenerateMatchSummary(
        form({ match_id: MATCH_ID, locale: "en", style_key: "custom", style_instruction: "  Focus on the keeper.  " }),
      ),
    ).rejects.toThrow(/regenResult=generated/);
    expect(generateMatchSummaryMock).toHaveBeenCalledWith(
      expect.anything(),
      MATCH_ID,
      { mode: "regenerate", style: { key: "custom", instruction: "Focus on the keeper." } },
    );
  });

  it("rejects a custom style with no instruction (UI-required guard)", async () => {
    const { regenerateMatchSummary } = await importActions();
    await expect(
      regenerateMatchSummary(form({ match_id: MATCH_ID, locale: "en", style_key: "custom" })),
    ).rejects.toThrow();
    expect(generateMatchSummaryMock).not.toHaveBeenCalled();
  });

  it("surfaces a no-events skip via the redirect params", async () => {
    generateMatchSummaryMock.mockResolvedValue({ generated: false, reason: "no-events" });
    const { regenerateMatchSummary } = await importActions();
    await expect(
      regenerateMatchSummary(form({ match_id: MATCH_ID, locale: "en", style_key: "neutral" })),
    ).rejects.toThrow(/regenResult=no-events/);
  });

  it("maps a thrown generator error to an error outcome, not a server error", async () => {
    generateMatchSummaryMock.mockRejectedValue(new Error("openrouter down"));
    const { regenerateMatchSummary } = await importActions();
    await expect(
      regenerateMatchSummary(form({ match_id: MATCH_ID, locale: "en", style_key: "neutral" })),
    ).rejects.toThrow(/regenResult=error/);
  });
});

describe("setActiveSummaryVersion action", () => {
  it("rejects a non-admin", async () => {
    profileSingleMock.mockResolvedValue({ data: { is_admin: false } });
    const { setActiveSummaryVersion } = await importActions();
    await expect(
      setActiveSummaryVersion(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow("Admin only");
  });

  it("deactivates all then activates the chosen version, in that order", async () => {
    const admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    holder.admin = admin;
    const { setActiveSummaryVersion } = await importActions();
    await expect(
      setActiveSummaryVersion(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/activateResult=activated/);
    expect(admin.updatePayloads).toEqual([{ is_active: false }, { is_active: true }]);
  });

  it("refuses a version that belongs to another match (no updates)", async () => {
    const admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: OTHER_MATCH_ID } });
    holder.admin = admin;
    const { setActiveSummaryVersion } = await importActions();
    await expect(
      setActiveSummaryVersion(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/activateResult=error/);
    expect(admin.updatePayloads).toEqual([]);
  });

  it("surfaces an error when the version is missing", async () => {
    holder.admin = makeAdmin({ version: null });
    const { setActiveSummaryVersion } = await importActions();
    await expect(
      setActiveSummaryVersion(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/activateResult=error/);
  });
});

describe("deleteSummaryVersion action", () => {
  it("refuses to delete the active version", async () => {
    const admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID, is_active: true } });
    holder.admin = admin;
    const { deleteSummaryVersion } = await importActions();
    await expect(
      deleteSummaryVersion(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/deleteResult=active-blocked/);
    expect(admin.deleteEq).not.toHaveBeenCalled();
  });

  it("deletes a non-active draft version", async () => {
    const admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID, is_active: false } });
    holder.admin = admin;
    const { deleteSummaryVersion } = await importActions();
    await expect(
      deleteSummaryVersion(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/deleteResult=deleted/);
    expect(admin.deleteEq).toHaveBeenCalledTimes(1);
  });

  it("surfaces an error when the version is missing", async () => {
    holder.admin = makeAdmin({ version: null });
    const { deleteSummaryVersion } = await importActions();
    await expect(
      deleteSummaryVersion(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/deleteResult=error/);
  });
});

describe("generateMatchImagePromptAction action", () => {
  it("rejects a non-admin and never generates", async () => {
    profileSingleMock.mockResolvedValue({ data: { is_admin: false } });
    const { generateMatchImagePromptAction } = await importActions();
    await expect(
      generateMatchImagePromptAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow("Admin only");
    expect(generateImagePromptMock).not.toHaveBeenCalled();
  });

  it("rejects a match outside the managed competition", async () => {
    assertMatchInManagedMock.mockRejectedValue(
      new Error("Match does not belong to the managed competition"),
    );
    const { generateMatchImagePromptAction } = await importActions();
    await expect(
      generateMatchImagePromptAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow("managed");
    expect(generateImagePromptMock).not.toHaveBeenCalled();
  });

  it("generates for a version that belongs to the match and surfaces success", async () => {
    const admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    holder.admin = admin;
    const { generateMatchImagePromptAction } = await importActions();
    await expect(
      generateMatchImagePromptAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/imagePromptResult=generated/);
    expect(generateImagePromptMock).toHaveBeenCalledWith(admin, SUMMARY_ID);
  });

  it("refuses a version that belongs to another match (no generation)", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: OTHER_MATCH_ID } });
    const { generateMatchImagePromptAction } = await importActions();
    await expect(
      generateMatchImagePromptAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/imagePromptResult=error/);
    expect(generateImagePromptMock).not.toHaveBeenCalled();
  });

  it("surfaces an error when the version is missing", async () => {
    holder.admin = makeAdmin({ version: null });
    const { generateMatchImagePromptAction } = await importActions();
    await expect(
      generateMatchImagePromptAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/imagePromptResult=error/);
    expect(generateImagePromptMock).not.toHaveBeenCalled();
  });

  it("surfaces the generator skip reason (no-key)", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    generateImagePromptMock.mockResolvedValue({ generated: false, reason: "no-key" });
    const { generateMatchImagePromptAction } = await importActions();
    await expect(
      generateMatchImagePromptAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/imagePromptResult=no-key/);
  });

  it("maps a thrown generator error to an error outcome, not a server error", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    generateImagePromptMock.mockRejectedValue(new Error("openrouter down"));
    const { generateMatchImagePromptAction } = await importActions();
    await expect(
      generateMatchImagePromptAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/imagePromptResult=error/);
  });
});

describe("renderMatchImageAction action", () => {
  it("rejects a non-admin and never requests a render", async () => {
    profileSingleMock.mockResolvedValue({ data: { is_admin: false } });
    const { renderMatchImageAction } = await importActions();
    await expect(
      renderMatchImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow("Admin only");
    expect(requestRenderMock).not.toHaveBeenCalled();
  });

  it("requests a render for a version that belongs to the match", async () => {
    const admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    holder.admin = admin;
    const { renderMatchImageAction } = await importActions();
    await expect(
      renderMatchImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/renderResult=requested/);
    expect(requestRenderMock).toHaveBeenCalledWith(admin, SUMMARY_ID);
  });

  it("refuses a version that belongs to another match (no render)", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: OTHER_MATCH_ID } });
    const { renderMatchImageAction } = await importActions();
    await expect(
      renderMatchImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/renderResult=error/);
    expect(requestRenderMock).not.toHaveBeenCalled();
  });

  it("surfaces the skip reason (no-prompt)", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    requestRenderMock.mockResolvedValue({ requested: false, reason: "no-prompt" });
    const { renderMatchImageAction } = await importActions();
    await expect(
      renderMatchImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/renderResult=no-prompt/);
  });

  it("maps a thrown render error to an error outcome", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    requestRenderMock.mockRejectedValue(new Error("leonardo down"));
    const { renderMatchImageAction } = await importActions();
    await expect(
      renderMatchImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/renderResult=error/);
  });
});

describe("syncMatchImageRenderAction action", () => {
  it("rejects a non-admin and never polls", async () => {
    profileSingleMock.mockResolvedValue({ data: { is_admin: false } });
    const { syncMatchImageRenderAction } = await importActions();
    await expect(
      syncMatchImageRenderAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow("Admin only");
    expect(pollRenderMock).not.toHaveBeenCalled();
  });

  it("syncs a pending render and surfaces success", async () => {
    const admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    holder.admin = admin;
    const { syncMatchImageRenderAction } = await importActions();
    await expect(
      syncMatchImageRenderAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/syncRenderResult=synced/);
    expect(pollRenderMock).toHaveBeenCalledWith(admin, SUMMARY_ID);
  });

  it("surfaces the pending reason when the render is not yet complete", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    pollRenderMock.mockResolvedValue({ polled: false, reason: "pending" });
    const { syncMatchImageRenderAction } = await importActions();
    await expect(
      syncMatchImageRenderAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/syncRenderResult=pending/);
  });
});

describe("generateAndRenderImageAction action", () => {
  it("rejects a non-admin and does nothing", async () => {
    profileSingleMock.mockResolvedValue({ data: { is_admin: false } });
    const { generateAndRenderImageAction } = await importActions();
    await expect(
      generateAndRenderImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow("Admin only");
    expect(generateImagePromptMock).not.toHaveBeenCalled();
    expect(requestRenderMock).not.toHaveBeenCalled();
  });

  it("generates the prompt then requests the render (comboResult=rendered)", async () => {
    const admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    holder.admin = admin;
    const { generateAndRenderImageAction } = await importActions();
    await expect(
      generateAndRenderImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/comboResult=rendered/);
    expect(generateImagePromptMock).toHaveBeenCalledWith(admin, SUMMARY_ID);
    expect(requestRenderMock).toHaveBeenCalledWith(admin, SUMMARY_ID);
  });

  it("refuses a version from another match (no prompt, no render)", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: OTHER_MATCH_ID } });
    const { generateAndRenderImageAction } = await importActions();
    await expect(
      generateAndRenderImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/comboResult=error/);
    expect(generateImagePromptMock).not.toHaveBeenCalled();
    expect(requestRenderMock).not.toHaveBeenCalled();
  });

  it("reports no-key and skips the render when the prompt step is dormant", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    generateImagePromptMock.mockResolvedValue({ generated: false, reason: "no-key" });
    const { generateAndRenderImageAction } = await importActions();
    await expect(
      generateAndRenderImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/comboResult=no-key/);
    expect(requestRenderMock).not.toHaveBeenCalled();
  });

  it("reports error and skips the render when the prompt step fails", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    generateImagePromptMock.mockResolvedValue({ generated: false, reason: "missing" });
    const { generateAndRenderImageAction } = await importActions();
    await expect(
      generateAndRenderImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/comboResult=error/);
    expect(requestRenderMock).not.toHaveBeenCalled();
  });

  it("reports prompt-only when the render is skipped", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    requestRenderMock.mockResolvedValue({ requested: false, reason: "no-key" });
    const { generateAndRenderImageAction } = await importActions();
    await expect(
      generateAndRenderImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/comboResult=prompt-only/);
  });

  it("reports prompt-only when the render throws (isolated)", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    requestRenderMock.mockRejectedValue(new Error("leonardo down"));
    const { generateAndRenderImageAction } = await importActions();
    await expect(
      generateAndRenderImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/comboResult=prompt-only/);
  });

  it("maps a thrown prompt error to comboResult=error", async () => {
    holder.admin = makeAdmin({ version: { id: SUMMARY_ID, match_id: MATCH_ID } });
    generateImagePromptMock.mockRejectedValue(new Error("openrouter down"));
    const { generateAndRenderImageAction } = await importActions();
    await expect(
      generateAndRenderImageAction(form({ summary_id: SUMMARY_ID, match_id: MATCH_ID, locale: "en" })),
    ).rejects.toThrow(/comboResult=error/);
    expect(requestRenderMock).not.toHaveBeenCalled();
  });
});
