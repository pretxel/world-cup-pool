import { beforeEach, describe, expect, it, vi } from "vitest";

// Landing-page tests for /[locale]/h2h/[a]/[b]: a non-canonical [a]/[b] order
// redirects to the canonical URL, and a missing player yields notFound() — both
// happen before any JSX renders, so navigation is stubbed to throw sentinels and
// the data layer + i18n are mocked.

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const notFoundMock = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  notFound: () => notFoundMock(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const t = (key: string) => key;
    t.raw = (key: string) => key;
    return t;
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({})),
}));

const loadH2HStandingsMock = vi.fn();
const loadRecentFormMock = vi.fn();
vi.mock("@/lib/h2h", () => ({
  loadH2HStandings: (...a: unknown[]) => loadH2HStandingsMock(...a),
  loadRecentForm: (...a: unknown[]) => loadRecentFormMock(...a),
}));

// Client components / UI bits are irrelevant to redirect/notFound control flow.
vi.mock("@/components/share-buttons", () => ({ ShareButtons: () => null }));
vi.mock("@/app/[locale]/(public)/h2h/[a]/[b]/h2h-view-tracker", () => ({
  H2HViewTracker: () => null,
}));
vi.mock("@/components/ui/button", () => ({ buttonVariants: () => "" }));

import H2HPage from "@/app/[locale]/(public)/h2h/[a]/[b]/page";

const STANDINGS = {
  a: { userId: "u-a", displayName: "Ada", rank: 3, totalPoints: 47, exactHits: 9 },
  b: { userId: "u-b", displayName: "Bo", rank: 5, totalPoints: 40, exactHits: 6 },
};

beforeEach(() => {
  redirectMock.mockClear();
  notFoundMock.mockClear();
  loadH2HStandingsMock.mockReset().mockResolvedValue(STANDINGS);
  loadRecentFormMock.mockReset().mockResolvedValue([]);
});

describe("H2HPage canonical ordering", () => {
  it("redirects to the canonical order when [a]/[b] is reversed", async () => {
    // "u-b"/"u-a" is non-canonical; canonical is u-a then u-b.
    await expect(
      H2HPage({ params: Promise.resolve({ locale: "en", a: "u-b", b: "u-a" }) }),
    ).rejects.toThrow("REDIRECT:/en/h2h/u-a/u-b");
    expect(redirectMock).toHaveBeenCalledWith("/en/h2h/u-a/u-b");
  });

  it("does not redirect when already canonical", async () => {
    await H2HPage({
      params: Promise.resolve({ locale: "en", a: "u-a", b: "u-b" }),
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("H2HPage missing player", () => {
  it("calls notFound when a player is absent", async () => {
    loadH2HStandingsMock.mockResolvedValueOnce(null);
    await expect(
      H2HPage({ params: Promise.resolve({ locale: "en", a: "u-a", b: "u-b" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
