import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRightIcon } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import type { NewsArticleRow } from "@/lib/db";
import { isHttpUrl } from "@/lib/news";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

// Surface a bounded, fresh slice of the cached feed.
const FEED_LIMIT = 40;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "news" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/news" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/news",
      type: "website",
    },
  };
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("news");

  const supabase = await createServerSupabaseClient();
  const { data: articles, error } = await supabase
    .from("news_articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(FEED_LIMIT);

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t("loadFailed", { message: error.message })}
        </div>
      </main>
    );
  }

  const list = (articles ?? []) as NewsArticleRow[];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t("lede")}
        </p>
      </header>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("emptyTitle")}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm">{t("emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id}>
              <ArticleCard article={a} readMore={t("readMore")} />
            </li>
          ))}
        </ul>
      )}
    </main>
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
