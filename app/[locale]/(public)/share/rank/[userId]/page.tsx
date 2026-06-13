import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

type RankParams = Promise<{ locale: string; userId: string }>;

// Read the shared user's standing live from the public overall view. Numbers
// are never taken from the URL — the URL only identifies the user — so a stale
// or tampered link always renders the truthful current rank.
async function loadStanding(userId: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: row }, { count }] = await Promise.all([
    supabase
      .from("v_leaderboard_overall")
      .select("rank, display_name, total_points, exact_hits")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("v_leaderboard_overall")
      .select("*", { count: "exact", head: true }),
  ]);
  if (!row) return null;
  return { row, players: count ?? 0 };
}

export async function generateMetadata({
  params,
}: {
  params: RankParams;
}): Promise<Metadata> {
  const { locale: raw, userId } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const standing = await loadStanding(userId);

  if (!standing) {
    return { robots: { index: false, follow: false } };
  }

  const t = await getTranslations({ locale, namespace: "shareRank" });
  const tBoard = await getTranslations({ locale, namespace: "leaderboard" });
  const { row, players } = standing;
  const name = row.display_name ?? tBoard("noName");
  const values = {
    rank: row.rank ?? 0,
    points: row.total_points ?? 0,
    count: players,
    name,
  };

  const og = new URLSearchParams({ userId, locale });
  const imageUrl = `/api/og/rank?${og.toString()}`;

  const title = t("pageTitle", values);
  const description = t("pageDescription", values);

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: t("ogAlt", values),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ShareRankPage({ params }: { params: RankParams }) {
  const { locale: raw, userId } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const standing = await loadStanding(userId);
  if (!standing) notFound();

  const t = await getTranslations("shareRank");
  const tBoard = await getTranslations("leaderboard");
  const { row, players } = standing;
  const name = row.display_name ?? tBoard("noName");
  const rank = row.rank ?? 0;
  const points = row.total_points ?? 0;
  const exact = row.exact_hits ?? 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        {t("pageEyebrow")}
      </p>
      <h1
        className="mt-1 font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
        style={{ fontStretch: "condensed" }}
      >
        {t("pageHeading")}
      </h1>

      <section className="bg-scoreboard relative mt-5 overflow-hidden rounded-2xl text-pitch-foreground ring-1 ring-pitch/30 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]">
        <div
          aria-hidden
          className="bg-pitch-stripes pointer-events-none absolute inset-0 opacity-[0.12]"
        />
        <div className="bg-grain pointer-events-none absolute inset-0" />

        <div className="relative flex flex-col items-center gap-2 px-6 pt-7 pb-3 text-center sm:pt-9">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/70">
            {t("rankLabel")}
          </span>
          <div
            className="font-heading text-6xl font-semibold leading-none tabular-nums sm:text-7xl"
            style={{ fontStretch: "condensed" }}
          >
            #{rank}
          </div>
          <div
            className="mt-1 max-w-full truncate font-heading text-2xl font-semibold leading-tight sm:text-3xl"
            style={{ fontStretch: "condensed" }}
          >
            {name}
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-pitch-foreground/70">
            {t("statPlayers", { count: players })}
          </p>
        </div>

        <div className="relative grid grid-cols-2 border-t border-pitch-foreground/15 bg-black/10">
          <div className="flex flex-col items-center gap-1 px-6 py-4">
            <span className="font-mono text-3xl font-semibold tabular-nums sm:text-4xl">
              {points}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-pitch-foreground/70">
              {t("pointsLabel")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 border-l border-pitch-foreground/15 px-6 py-4">
            <span className="font-mono text-3xl font-semibold tabular-nums sm:text-4xl">
              {exact}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-pitch-foreground/70">
              {t("exactLabel")}
            </span>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <Link
          href={localePath(locale, "/leaderboard")}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-10 gap-2 px-5 text-sm font-semibold uppercase tracking-[0.16em]",
          )}
        >
          {t("cta")}
        </Link>
      </div>
    </main>
  );
}
