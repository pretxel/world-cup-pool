import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { fetchNewsFeed, type NewsArticle } from "@/lib/news";

type Summary = {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
};

function unauthorized() {
  return new NextResponse("unauthorized", { status: 401 });
}

function skipped(reason: string) {
  return new NextResponse(null, {
    status: 204,
    headers: { "x-skipped": reason },
  });
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

export async function GET(request: NextRequest) {
  // 1. Auth: require Bearer ${CRON_SECRET}. In non-prod with no secret, allow.
  const auth = request.headers.get("authorization");
  const isProd = process.env.NODE_ENV === "production";
  if (env.cronSecret) {
    if (auth !== `Bearer ${env.cronSecret}`) return unauthorized();
  } else if (isProd) {
    return skipped("missing-env");
  }

  // 2. Token gate.
  if (!env.newsApiToken) return skipped("missing-env");

  // 3. Fetch + normalize (throws on non-OK upstream → leaves cache untouched).
  const { articles, rawCount } = await fetchNewsFeed(
    env.newsApiToken,
    env.newsApiUrl ?? undefined,
  );

  const summary: Summary = {
    // fetched = raw upstream count; skipped = items dropped for invalid
    // fields / non-http scheme / in-batch dedup. inserted+updated+skipped
    // === fetched (absent an upsert error).
    fetched: rawCount,
    inserted: 0,
    updated: 0,
    skipped: rawCount - articles.length,
    errors: 0,
  };

  if (articles.length === 0) {
    console.log(`[cron:sync-news] summary:`, JSON.stringify(summary));
    return NextResponse.json(summary);
  }

  const admin = createAdminSupabaseClient();

  // 4. Partition into new vs existing for an accurate summary.
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

  // 5. Upsert. onConflict=dedup_key makes repeated runs idempotent — existing
  //    rows refresh their mutable fields instead of duplicating.
  const { error: upsertErr } = await admin
    .from("news_articles")
    .upsert(articles.map(toRow), { onConflict: "dedup_key" });
  if (upsertErr) {
    summary.errors++;
    summary.inserted = 0;
    summary.updated = 0;
    console.error(`[cron:sync-news] upsert failed:`, upsertErr.message);
  }

  console.log(`[cron:sync-news] summary:`, JSON.stringify(summary));
  return NextResponse.json(summary);
}
