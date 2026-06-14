import "server-only";
import { env } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { fetchNewsFeed, type NewsArticle } from "@/lib/news";
import { getActiveBranding } from "@/lib/competition";

// One news-sync run's outcome. fetched = raw upstream count; skipped = items
// dropped for invalid fields / non-http scheme / in-batch dedup; inserted +
// updated + skipped === fetched (absent an upsert error).
export interface NewsSyncSummary {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

function toRow(a: NewsArticle) {
  return {
    dedup_key: a.dedupKey,
    external_id: a.externalId,
    source_url: a.sourceUrl,
    title: a.title,
    summary: a.summary,
    image_url: a.imageUrl,
    source: a.source,
    published_at: a.publishedAt,
  };
}

// Fetches, normalizes, and idempotently upserts the active competition's news
// feed, returning a count summary. Shared by the sync-news cron and the admin
// "Run now" trigger so both go through identical logic. Assumes the caller has
// already gated on env.newsApiToken (the cron returns a 204 skip when unset).
export async function runNewsSync(): Promise<NewsSyncSummary> {
  if (!env.newsApiToken) throw new Error("NEWS_API_TOKEN is not set");

  // The search query comes from the active competition's branding.
  const { newsQuery } = await getActiveBranding();
  const { articles, rawCount } = await fetchNewsFeed(
    env.newsApiToken,
    env.newsApiUrl ?? undefined,
    newsQuery,
  );

  const summary: NewsSyncSummary = {
    fetched: rawCount,
    inserted: 0,
    updated: 0,
    skipped: rawCount - articles.length,
    errors: 0,
  };

  if (articles.length === 0) return summary;

  const admin = createAdminSupabaseClient();

  // Partition into new vs existing for an accurate summary.
  const keys = articles.map((a) => a.dedupKey);
  const { data: existingRows, error: loadErr } = await admin
    .from("news_articles")
    .select("dedup_key")
    .in("dedup_key", keys);
  if (loadErr) {
    throw new Error(`Failed to load existing news: ${loadErr.message}`);
  }
  const existing = new Set((existingRows ?? []).map((r) => r.dedup_key));
  summary.updated = articles.filter((a) => existing.has(a.dedupKey)).length;
  summary.inserted = articles.length - summary.updated;

  // onConflict=dedup_key makes repeated runs idempotent — existing rows refresh
  // their mutable fields instead of duplicating.
  const { error: upsertErr } = await admin
    .from("news_articles")
    .upsert(articles.map(toRow), { onConflict: "dedup_key" });
  if (upsertErr) {
    summary.errors++;
    summary.inserted = 0;
    summary.updated = 0;
    console.error(`[news-sync] upsert failed:`, upsertErr.message);
  }

  return summary;
}
