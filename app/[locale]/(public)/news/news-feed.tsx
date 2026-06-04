"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRightIcon, Loader2Icon } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import type { NewsArticleRow } from "@/lib/db";
import { isHttpUrl } from "@/lib/news";
import { loadMoreNews } from "./actions";

export function NewsFeed({
  initial,
  initialHasMore,
}: {
  initial: NewsArticleRow[];
  initialHasMore: boolean;
}) {
  const t = useTranslations("news");
  const [articles, setArticles] = useState<NewsArticleRow[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Guards against the observer firing a second load before the first resolves.
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!hasMore || failed) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        startTransition(async () => {
          const res = await loadMoreNews(articles.length);
          if (res.ok) {
            setArticles((prev) => [...prev, ...res.articles]);
            setHasMore(res.hasMore);
          } else {
            setFailed(true);
            setHasMore(false);
          }
          loadingRef.current = false;
        });
      },
      // Prefetch a screen early so loading feels seamless.
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [articles.length, hasMore, failed]);

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {articles.map((a) => (
          <li key={a.id}>
            <ArticleCard article={a} readMore={t("readMore")} />
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-8 text-sm text-muted-foreground"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              {t("loadingMore")}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="py-8 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {failed ? t("loadMoreFailed") : t("endOfFeed")}
        </p>
      )}
    </>
  );
}

function ArticleCard({
  article,
  readMore,
}: {
  article: NewsArticleRow;
  readMore: string;
}) {
  // Defense-in-depth: the sync already rejects non-http(s) schemes, but guard
  // again at render so untrusted feed data can never produce a javascript:
  // href or an off-scheme image src.
  const href = isHttpUrl(article.source_url) ? article.source_url : undefined;
  const imageSrc =
    article.image_url && isHttpUrl(article.image_url) ? article.image_url : null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group/news flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-muted/50"
    >
      {imageSrc ? (
        // External CDN host is arbitrary per article, so skip next/image
        // optimization and render the source thumbnail directly.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-[16/9] w-full object-cover"
        />
      ) : null}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground">
          {article.title}
        </h2>
        {article.summary ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {article.summary}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            {article.source ? (
              <span className="truncate font-medium text-foreground">
                {article.source}
              </span>
            ) : null}
            <span aria-hidden>·</span>
            <LocalTime iso={article.published_at} format="date" />
          </span>
          <span className="flex shrink-0 items-center gap-1 font-mono uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover/news:text-foreground">
            {readMore}
            <ArrowUpRightIcon className="size-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </a>
  );
}
