import { beforeEach, describe, expect, it, vi } from "vitest";

// Route tests for GET /api/og/h2h: 200 with ETag + cache headers for two valid
// players, 304 when If-None-Match echoes that ETag, and 404 when either player
// is missing. ImageResponse, fonts, supabase, and i18n are mocked so the test
// asserts the route's control flow (validation, ETag, conditional cache) without
// rasterizing or hitting a database.

vi.mock("next/og", () => ({
  // Echo the headers so the test can assert ETag + Cache-Control are set, and
  // mark the body so a real raster is distinguishable from a 304.
  ImageResponse: class {
    status = 200;
    headers: Headers;
    constructor(_el: unknown, opts: { headers?: Record<string, string> }) {
      this.headers = new Headers(opts.headers ?? {});
    }
  },
}));

vi.mock("@/lib/og-fonts", () => ({
  loadOgFonts: vi.fn(async () => []),
  loadDisplayNameFallback: vi.fn(async () => []),
  OG_FONT_FAMILY: { heading: "H", mono: "M" },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

const loadH2HStandingsMock = vi.fn();
const loadRecentFormMock = vi.fn();
vi.mock("@/lib/h2h", () => ({
  loadH2HStandings: (...a: unknown[]) => loadH2HStandingsMock(...a),
  loadRecentForm: (...a: unknown[]) => loadRecentFormMock(...a),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({}),
}));

import { GET } from "@/app/api/og/h2h/route";

const STANDINGS = {
  a: { userId: "u-a", displayName: "Ada", rank: 3, totalPoints: 47, exactHits: 9 },
  b: { userId: "u-b", displayName: "Bo", rank: 5, totalPoints: 40, exactHits: 6 },
};

function req(query: string, headers?: Record<string, string>): Request {
  return new Request(`https://x.test/api/og/h2h?${query}`, { headers });
}

beforeEach(() => {
  loadH2HStandingsMock.mockReset().mockResolvedValue(STANDINGS);
  loadRecentFormMock.mockReset().mockResolvedValue([{ matchId: "m1", outcome: "hit" }]);
});

describe("GET /api/og/h2h", () => {
  it("returns 400 when a or b is missing", async () => {
    expect((await GET(req("a=u-a"))).status).toBe(400);
    expect((await GET(req("b=u-b"))).status).toBe(400);
  });

  it("renders a card with ETag + cache headers for two valid players", async () => {
    const res = await GET(req("a=u-a&b=u-b&locale=en"));
    expect(res.status).toBe(200);
    const etag = res.headers.get("ETag");
    expect(etag).toBeTruthy();
    expect(etag!.startsWith('"')).toBe(true);
    expect(res.headers.get("Cache-Control")).toContain("max-age=300");
  });

  it("answers 304 when If-None-Match echoes the current ETag", async () => {
    const first = await GET(req("a=u-a&b=u-b&locale=en"));
    const etag = first.headers.get("ETag")!;
    const second = await GET(req("a=u-a&b=u-b&locale=en", { "if-none-match": etag }));
    expect(second.status).toBe(304);
    expect(second.headers.get("ETag")).toBe(etag);
  });

  it("returns 404 when either player is missing", async () => {
    loadH2HStandingsMock.mockResolvedValueOnce(null);
    expect((await GET(req("a=u-a&b=u-missing"))).status).toBe(404);
  });
});
