import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { TeamFlag } from "@/components/team-flag";
import { StageIcon } from "@/components/stage-icon";
import { buttonVariants } from "@/components/ui/button";
import { clampGoals } from "@/lib/share";
import { getActiveStageLabel } from "@/lib/competition";
import { cn } from "@/lib/utils";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

type ShareParams = Promise<{ locale: string; matchId: string }>;
type ShareSearchParams = Promise<{ h?: string | string[]; a?: string | string[] }>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: ShareParams;
  searchParams: ShareSearchParams;
}): Promise<Metadata> {
  const { locale: raw, matchId } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const { h: hParam, a: aParam } = await searchParams;
  const t = await getTranslations({ locale, namespace: "sharePick" });

  const supabase = await createServerSupabaseClient();
  const { data: match } = await supabase
    .from("matches")
    .select("home_team, away_team")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) {
    return { robots: { index: false, follow: false } };
  }

  const h = clampGoals(single(hParam));
  const a = clampGoals(single(aParam));
  const hasScores = h !== null && a !== null;
  const values = {
    home: match.home_team,
    away: match.away_team,
    h: h ?? 0,
    a: a ?? 0,
  };
  const title = hasScores
    ? t("pageTitle", values)
    : `${match.home_team} vs ${match.away_team}`;
  const description = t("pageDescription", values);

  const og = new URLSearchParams({ matchId, locale });
  if (hasScores) {
    og.set("h", String(h));
    og.set("a", String(a));
  }
  const imageUrl = `/api/og/pick?${og.toString()}`;

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

export default async function SharePickPage({
  params,
  searchParams,
}: {
  params: ShareParams;
  searchParams: ShareSearchParams;
}) {
  const { locale: raw, matchId } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const { h: hParam, a: aParam } = await searchParams;
  const t = await getTranslations("sharePick");

  const supabase = await createServerSupabaseClient();
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) notFound();

  const stageLabel = await getActiveStageLabel(match.stage, locale);

  // Scores come from the URL the sharer published — never from anyone's
  // stored prediction. Invalid/missing values degrade to a scoreless card.
  const h = clampGoals(single(hParam));
  const a = clampGoals(single(aParam));
  const hasScores = h !== null && a !== null;

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

        <div className="relative px-6 pt-5 pb-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-pitch-foreground/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/80 ring-1 ring-pitch-foreground/15">
            <StageIcon stage={match.stage} className="size-3" />
            {stageLabel}
            {match.group_code ? ` · ${match.group_code}` : ""}
          </span>
        </div>

        <div className="relative flex flex-col gap-3 px-6 pt-3 pb-6 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6 sm:px-8">
          <div className="min-w-0">
            <div className="mt-1 flex items-center gap-2 sm:gap-3">
              <TeamFlag team={match.home_team} size="lg" />
              <span
                className="min-w-0 truncate font-heading text-2xl font-semibold leading-tight sm:text-3xl"
                style={{ fontStretch: "condensed" }}
              >
                {match.home_team}
              </span>
            </div>
          </div>

          <div className="grid place-items-center">
            {hasScores ? (
              <div className="font-mono text-4xl font-semibold leading-none tabular-nums sm:text-5xl">
                {h}
                <span className="px-1 text-pitch-foreground/40">–</span>
                {a}
              </div>
            ) : (
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/70">
                vs
              </div>
            )}
          </div>

          <div className="min-w-0 text-right">
            <div className="mt-1 flex items-center justify-end gap-2 sm:gap-3">
              <span
                className="min-w-0 truncate font-heading text-2xl font-semibold leading-tight sm:text-3xl"
                style={{ fontStretch: "condensed" }}
              >
                {match.away_team}
              </span>
              <TeamFlag team={match.away_team} size="lg" />
            </div>
          </div>
        </div>

        <div className="relative border-t border-pitch-foreground/15 bg-black/10 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-pitch-foreground/85">
          <LocalTime iso={match.kickoff_at} />
          {match.venue ? (
            <span className="text-pitch-foreground/70"> · {match.venue}</span>
          ) : null}
        </div>
      </section>

      <div className="mt-8">
        <Link
          href={localePath(locale, `/matches/${match.id}`)}
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
