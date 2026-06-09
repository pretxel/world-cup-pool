import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { NewsArticleRow } from "@/lib/db";
import { NEWS_PAGE_SIZE } from "@/lib/news";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { NewsFeed } from "./news-feed";

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

  // Server-render the first page for fast paint + SEO; the rest streams in via
  // infinite scroll (NewsFeed → loadMoreNews). Ordering must match the action.
  const supabase = await createServerSupabaseClient();
  const { data: articles, error } = await supabase
    .from("news_articles")
    .select("*")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, NEWS_PAGE_SIZE - 1);

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t("loadFailed", { message: error.message })}
        </div>
      </main>
    );
  }

  const list = (articles ?? []) as NewsArticleRow[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-1 font-heading text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl"
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
        <NewsFeed initial={list} initialHasMore={list.length === NEWS_PAGE_SIZE} />
      )}
    </main>
  );
}
