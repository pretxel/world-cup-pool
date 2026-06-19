import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LeaderboardLive } from "@/components/leaderboard-live";
import { LeaderboardViewTracker } from "./leaderboard-view-tracker";
import { ShareButtons } from "@/components/share-buttons";
import type { LeaderboardRow } from "@/lib/db";
import { ArrowRightIcon } from "lucide-react";
import { buildRankSharePath } from "@/lib/share";
import { env } from "@/lib/env";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leaderboard" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/leaderboard" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/leaderboard",
      type: "website",
    },
  };
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("leaderboard");
  const tShare = await getTranslations("shareRank");

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("v_leaderboard_overall")
    .select("*")
    .order("rank", { ascending: true });

  const loadError = error?.message ?? null;
  const rows: LeaderboardRow[] = (data ?? []) as LeaderboardRow[];

  const myRow = user ? rows.find((r) => r.user_id === user.id) : undefined;
  const players = rows.length;
  const leader = rows[0];
  const topRows = rows.slice(0, 10);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <LeaderboardViewTracker />
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
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
        </div>

        {leader ? (
          <div className="rounded-xl border border-pitch/30 bg-pitch text-pitch-foreground px-4 py-3 shadow-sm">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/70">
              {t("leaderLabel")}
            </div>
            <div className="mt-1 font-heading text-lg font-semibold tracking-tight">
              {leader.display_name ?? "—"}
            </div>
            <div className="mt-0.5 font-mono text-xs uppercase tracking-[0.18em] text-pitch-foreground/80">
              {t("leaderStat", {
                points: leader.total_points ?? 0,
                count: players,
              })}
            </div>
          </div>
        ) : null}
      </header>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("emptyTitle")}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {t("emptyBody")}
          </p>
          <Link
            href={localePath(locale, "/matches")}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:text-pitch hover:underline"
          >
            {t("browseMatches")} <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      ) : (
        <LeaderboardLive
          initialRows={topRows}
          currentUserId={user?.id}
          labels={{
            rank: t("headerRank"),
            player: t("headerPlayer"),
            points: t("headerPoints"),
            exact: t("headerExact"),
            winnerGd: t("headerWinnerGd"),
            wins: t("headerWins"),
            you: t("you"),
            noName: t("noName"),
          }}
        />
      )}

      {myRow ? (
        <section className="mt-6">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {tShare("heading")}
          </p>
          <ShareButtons
            context="rank"
            shareUrl={`${env.siteUrl}${buildRankSharePath(locale, myRow.user_id)}`}
            shareText={tShare("shareText", {
              rank: myRow.rank ?? 0,
              count: players,
              points: myRow.total_points ?? 0,
            })}
            labels={{
              x: tShare("shareOnX"),
              facebook: tShare("shareOnFacebook"),
              native: tShare("shareNative"),
              copy: tShare("copyLink"),
              copied: tShare("copied"),
            }}
          />
        </section>
      ) : null}

      {user && !myRow && rows.length > 0 ? (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{t("notYetTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("notYetBody")}</p>
          </div>
          <Link
            href={localePath(locale, "/matches")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:text-pitch hover:underline"
          >
            {t("browseMatches")} <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      ) : null}

      {user ? (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{t("inviteCtaTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("inviteCtaBody")}</p>
          </div>
          <Link
            href={localePath(locale, "/groups")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:text-pitch hover:underline"
          >
            {t("inviteCtaLink")} <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </main>
  );
}
