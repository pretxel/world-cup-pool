import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ShareButtons } from "@/components/share-buttons";
import { H2HViewTracker } from "./h2h-view-tracker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { loadH2HStandings, loadRecentForm, type FormPip, type H2HStanding } from "@/lib/h2h";
import { buildH2HPath, canonicalH2HPair } from "@/lib/share";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

type H2HParams = Promise<{ locale: string; a: string; b: string }>;

export async function generateMetadata({ params }: { params: H2HParams }): Promise<Metadata> {
  const { locale: raw, a, b } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const [first, second] = canonicalH2HPair(a, b);

  const supabase = await createServerSupabaseClient();
  const standings = await loadH2HStandings(supabase, first, second);
  if (!standings) {
    return { robots: { index: false, follow: false } };
  }

  const t = await getTranslations({ locale, namespace: "h2h" });
  const tBoard = await getTranslations({ locale, namespace: "leaderboard" });
  const nameA = standings.a.displayName ?? tBoard("noName");
  const nameB = standings.b.displayName ?? tBoard("noName");
  const values = {
    a: nameA,
    b: nameB,
    rankA: standings.a.rank,
    rankB: standings.b.rank,
  };

  const og = new URLSearchParams({ a: first, b: second, locale });
  const imageUrl = `/api/og/h2h?${og.toString()}`;

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

function FormStrip({ pips, emptyLabel }: { pips: FormPip[]; emptyLabel: string }) {
  if (pips.length === 0) {
    return (
      <span className="text-pitch-foreground/50 font-mono text-[10px] tracking-[0.18em] uppercase">
        {emptyLabel}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      {pips.map((p, i) => (
        <span
          key={i}
          className={cn(
            "size-2.5 rounded-full",
            p.outcome === "hit" ? "bg-pitch-foreground" : "bg-pitch-foreground/25",
          )}
        />
      ))}
    </div>
  );
}

function PlayerColumn({
  standing,
  name,
  pips,
  labels,
}: {
  standing: H2HStanding;
  name: string;
  pips: FormPip[];
  labels: {
    points: string;
    exact: string;
    form: string;
    formEmpty: string;
  };
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      <div
        className="font-heading text-5xl leading-none font-semibold tabular-nums sm:text-6xl"
        style={{ fontStretch: "condensed" }}
      >
        #{standing.rank}
      </div>
      <div
        className="font-heading mt-1 max-w-full truncate text-xl leading-tight font-semibold sm:text-2xl"
        style={{ fontStretch: "condensed" }}
      >
        {name}
      </div>
      <div className="mt-2 flex items-center gap-5">
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
            {standing.totalPoints}
          </span>
          <span className="text-pitch-foreground/70 font-mono text-[9px] tracking-[0.16em] uppercase">
            {labels.points}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
            {standing.exactHits}
          </span>
          <span className="text-pitch-foreground/70 font-mono text-[9px] tracking-[0.16em] uppercase">
            {labels.exact}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-col items-center gap-1.5">
        <span className="text-pitch-foreground/60 font-mono text-[9px] tracking-[0.16em] uppercase">
          {labels.form}
        </span>
        <FormStrip pips={pips} emptyLabel={labels.formEmpty} />
      </div>
    </div>
  );
}

export default async function H2HPage({ params }: { params: H2HParams }) {
  const { locale: raw, a, b } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  // Collapse `a/b` and `b/a` to one canonical URL so the OG ETag/CDN cache has a
  // single key per rivalry and the displayed left/right ordering is stable.
  const [first, second] = canonicalH2HPair(a, b);
  if (a !== first || b !== second) {
    redirect(buildH2HPath(locale, first, second));
  }

  const supabase = await createServerSupabaseClient();
  const standings = await loadH2HStandings(supabase, first, second);
  if (!standings) notFound();

  const [formA, formB] = await Promise.all([
    loadRecentForm(supabase, first),
    loadRecentForm(supabase, second),
  ]);

  const t = await getTranslations("h2h");
  const tBoard = await getTranslations("leaderboard");
  const nameA = standings.a.displayName ?? tBoard("noName");
  const nameB = standings.b.displayName ?? tBoard("noName");

  const columnLabels = {
    points: t("pointsLabel"),
    exact: t("exactLabel"),
    form: t("formLabel"),
    formEmpty: t("formEmpty"),
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <H2HViewTracker />
      <p className="text-muted-foreground font-mono text-[11px] tracking-[0.24em] uppercase">
        {t("pageEyebrow")}
      </p>
      <h1
        className="font-heading mt-1 text-3xl font-semibold tracking-tight sm:text-4xl"
        style={{ fontStretch: "condensed" }}
      >
        {t("pageHeading")}
      </h1>

      <section className="bg-scoreboard text-pitch-foreground ring-pitch/30 relative mt-5 overflow-hidden rounded-2xl shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)] ring-1">
        <div
          aria-hidden
          className="bg-pitch-stripes pointer-events-none absolute inset-0 opacity-[0.12]"
        />
        <div className="bg-grain pointer-events-none absolute inset-0" />

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-stretch">
          <PlayerColumn standing={standings.a} name={nameA} pips={formA} labels={columnLabels} />
          <div className="flex items-center justify-center px-2">
            <span
              className="font-heading text-pitch-foreground/80 text-2xl leading-none font-semibold uppercase sm:text-3xl"
              style={{ fontStretch: "condensed" }}
            >
              {t("vsLabel")}
            </span>
          </div>
          <PlayerColumn standing={standings.b} name={nameB} pips={formB} labels={columnLabels} />
        </div>
      </section>

      <section className="mt-8">
        <p className="text-muted-foreground mb-3 font-mono text-[11px] tracking-[0.2em] uppercase">
          {t("shareHeading")}
        </p>
        <ShareButtons
          context="h2h"
          shareUrl={`${env.siteUrl}${buildH2HPath(locale, first, second)}`}
          shareText={t("shareText", { a: nameA, b: nameB })}
          labels={{
            x: t("shareOnX"),
            facebook: t("shareOnFacebook"),
            native: t("shareNative"),
            copy: t("copyLink"),
            copied: t("copied"),
          }}
        />
      </section>

      <div className="mt-8">
        <Link
          href={localePath(locale, "/leaderboard")}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-10 gap-2 px-5 text-sm font-semibold tracking-[0.16em] uppercase",
          )}
        >
          {t("cta")}
        </Link>
      </div>
    </main>
  );
}
