"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { NewsArticleRow } from "@/lib/db";
import { NEWS_PAGE_SIZE } from "@/lib/news";

export type LoadMoreResult =
  | { ok: true; articles: NewsArticleRow[]; hasMore: boolean }
  | { ok: false; error: string };

/**
 * Return the next page of cached news for the infinite-scroll feed. Offset
 * pagination over a stable (published_at desc, id desc) ordering — the feed
 * only changes on the daily cron, so offsets are stable within a scroll
 * session. RLS keeps this read public.
 */
export async function loadMoreNews(offset: number): Promise<LoadMoreResult> {
  if (!Number.isInteger(offset) || offset < 0) {
    return { ok: false, error: "invalid offset" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("news_articles")
    .select("*")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + NEWS_PAGE_SIZE - 1);

  if (error) return { ok: false, error: error.message };

  const articles = (data ?? []) as NewsArticleRow[];
  return { ok: true, articles, hasMore: articles.length === NEWS_PAGE_SIZE };
}
