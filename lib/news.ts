// News feed sourcing for the public /news section.
//
// Pulls World Cup 2026 headlines from an external provider (NewsAPI.org's
// /v2/everything by default) and normalizes them into rows for the
// `news_articles` cache. The fetch lives in `fetchNewsFeed`; everything it
// depends on for shaping/dedup is a pure function so it can be unit-tested
// without the network.

export type NewsArticle = {
  // Stable dedup key — provider id when present, else the normalized URL.
  dedupKey: string;
  externalId: string | null;
  sourceUrl: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  source: string | null;
  publishedAt: string; // ISO 8601
};

// Default provider: NewsAPI.org "everything" search endpoint.
export const DEFAULT_NEWS_URL = "https://newsapi.org/v2/everything";

// Constrain the feed to World Cup 2026 coverage.
export const NEWS_QUERY = '"World Cup 2026" OR "FIFA World Cup 2026"';

// Shape returned by NewsAPI.org /v2/everything. Fields are optional/nullable
// because upstream is not guaranteed to populate them.
type NewsApiArticle = {
  source?: { id?: string | null; name?: string | null } | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  urlToImage?: string | null;
  publishedAt?: string | null;
};

type NewsApiResponse = {
  status?: string;
  articles?: NewsApiArticle[];
};

/**
 * True only for http(s) URLs. Feed content is untrusted, so any other scheme
 * (javascript:, data:, etc.) must never reach an <a href> or <img src>.
 */
export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Strip query string, fragment, and a trailing slash so trivially-different
 * URLs for the same article collapse to one dedup key. Host case is lowered;
 * path case is preserved (paths can be case-sensitive).
 */
export function normalizeSourceUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.search = "";
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

/** Build the idempotent dedup key for an article. */
export function dedupKeyFor(externalId: string | null, sourceUrl: string): string {
  if (externalId && externalId.trim()) return `id:${externalId.trim()}`;
  return `url:${normalizeSourceUrl(sourceUrl)}`;
}

/**
 * Map a raw NewsAPI response into normalized articles. Drops items missing a
 * URL, title, or publish date, and deduplicates within the batch by dedup key
 * (first occurrence wins).
 */
export function mapNewsApiResponse(json: NewsApiResponse): NewsArticle[] {
  const raw = json.articles ?? [];
  const out: NewsArticle[] = [];
  const seen = new Set<string>();

  for (const a of raw) {
    const sourceUrl = (a.url ?? "").trim();
    const title = (a.title ?? "").trim();
    const publishedAt = (a.publishedAt ?? "").trim();
    if (!sourceUrl || !title || !publishedAt) continue;
    // Untrusted feed: only http(s) links may be stored/rendered. Drop anything
    // else (javascript:, data:, …) so it can never reach an <a href>.
    if (!isHttpUrl(sourceUrl)) continue;

    const externalId = null; // NewsAPI exposes no stable per-article id.
    const dedupKey = dedupKeyFor(externalId, sourceUrl);
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    // Same scheme guard for the thumbnail; null it out rather than dropping
    // the whole article when the image URL is unusable.
    const rawImage = a.urlToImage?.trim() || null;
    const imageUrl = rawImage && isHttpUrl(rawImage) ? rawImage : null;

    out.push({
      dedupKey,
      externalId,
      sourceUrl,
      title,
      summary: a.description?.trim() || null,
      imageUrl,
      source: a.source?.name?.trim() || null,
      publishedAt,
    });
  }

  return out;
}

/**
 * Build the request URL with query params for the default provider. The token
 * is sent via the X-Api-Key header (see fetchNewsFeed), NOT in the query
 * string — secrets in URLs leak into proxy/access logs.
 */
export function buildNewsRequestUrl(baseUrl: string): string {
  const u = new URL(baseUrl);
  if (!u.searchParams.has("q")) u.searchParams.set("q", NEWS_QUERY);
  u.searchParams.set("sortBy", "publishedAt");
  u.searchParams.set("pageSize", "50");
  return u.toString();
}

export type NewsFeedResult = {
  // Raw count of articles upstream returned, before normalization/dedup.
  rawCount: number;
  // Articles that survived validation + dedup.
  articles: NewsArticle[];
};

/**
 * Fetch and normalize the news feed. Throws on a non-OK upstream response so
 * the cron route surfaces the failure (and leaves the cache untouched).
 * Returns both the raw upstream count and the kept articles so callers can
 * report an accurate skipped/kept breakdown.
 */
export async function fetchNewsFeed(
  token: string,
  baseUrl: string = DEFAULT_NEWS_URL,
): Promise<NewsFeedResult> {
  const resp = await fetch(buildNewsRequestUrl(baseUrl), {
    headers: { "X-Api-Key": token },
    cache: "no-store",
  });
  if (!resp.ok) {
    throw new Error(`News fetch failed: ${resp.status} ${resp.statusText}`);
  }
  const json = (await resp.json()) as NewsApiResponse;
  return {
    rawCount: json.articles?.length ?? 0,
    articles: mapNewsApiResponse(json),
  };
}
