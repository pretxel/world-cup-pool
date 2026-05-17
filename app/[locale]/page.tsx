import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRightIcon, TargetIcon, TrophyIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { MiniBracket } from "@/components/mini-bracket";
import { TeamFlagWall } from "@/components/team-flag-wall";
import { TeamFlag } from "@/components/team-flag";
import { Logotype } from "@/components/logotype";
import { TournamentCountdown } from "@/components/tournament-countdown";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("title"), description: t("description") };
}

type T = Awaited<ReturnType<typeof getTranslations<"home">>>;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <main>
      <Hero locale={locale} t={t} />
      <TournamentCountdown />
      <ScoringSection locale={locale} t={t} />
      <FlagWallDivider />
      <Cadence t={t} />
    </main>
  );
}

function Hero({ locale, t }: { locale: Locale; t: T }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/70">
      <div
        aria-hidden
        className="bg-pitch-stripes absolute -right-32 -top-24 h-[42rem] w-[42rem] -rotate-12 opacity-[0.08] dark:opacity-[0.18]"
        style={{
          maskImage:
            "radial-gradient(closest-side at 50% 50%, black 35%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(closest-side at 50% 50%, black 35%, transparent 75%)",
        }}
      />
      <div className="bg-grain pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 lg:grid-cols-[1.6fr_1fr] lg:items-end">
        <div className="rise" style={{ animationDelay: "0ms" }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
            <span aria-hidden className="size-1.5 rounded-full bg-flag" />
            {t("eyebrow")}
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1">
              <TeamFlag team="United States" size="sm" className="h-3 w-4" />
              <TeamFlag team="Canada" size="sm" className="h-3 w-4" />
              <TeamFlag team="Mexico" size="sm" className="h-3 w-4" />
            </span>
            {t("hostsLine")}
          </div>

          <div className="mt-4">
            <Logotype
              size="xl"
              className="text-foreground"
              ariaLabel="WC26 Pool"
            />
          </div>
          <h1
            className="mt-6 font-heading text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-[5rem]"
            style={{ fontStretch: "condensed" }}
          >
            <span className="block">{t("headlineLine1")}</span>
            <span className="block text-pitch">{t("headlineLine2")}</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("lede")}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={localePath(locale, "/sign-in")}
              className={buttonVariants({
                size: "lg",
                className:
                  "h-11 gap-2 px-5 text-sm font-semibold uppercase tracking-[0.16em]",
              })}
            >
              {t("ctaSignIn")}
              <ArrowRightIcon />
            </Link>
            <Link
              href={localePath(locale, "/matches")}
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className: "h-11 px-5 text-sm font-medium",
              })}
            >
              {t("ctaBrowse")}
            </Link>
            <Link
              href="#scoring"
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("ctaScoring")}
            </Link>
          </div>
        </div>

        <div
          className="rise relative overflow-hidden rounded-2xl ring-1 ring-border bg-card shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]"
          style={{ animationDelay: "120ms" }}
        >
          <div className="bg-scoreboard relative px-5 py-4 text-pitch-foreground">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-pitch-foreground/70">
              <span>{t("demoMatchday")}</span>
              <span className="live-pulse">{t("demoLive")}</span>
            </div>
            <div className="mt-3">
              <MiniBracket />
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border bg-card text-center">
            <Stat label={t("demoYourPick")} value="2 – 1" mono accent="pitch" />
            <Stat label={t("demoPoints")} value="+5" mono accent="flag" />
            <Stat label={t("demoDailyRank")} value="↑12" mono />
          </div>
          <div className="border-t border-border bg-muted/40 px-5 py-3 text-[11px] text-muted-foreground">
            {t("demoFootnote")}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "pitch" | "flag";
}) {
  return (
    <div className="px-3 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold leading-none",
          mono && "font-mono tabular-nums",
          accent === "pitch" && "text-pitch",
          accent === "flag" && "text-flag",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ScoringSection({ locale, t }: { locale: Locale; t: T }) {
  const scoringTiers: Array<{
    pts: number;
    titleKey:
      | "scoringTierExactTitle"
      | "scoringTierWinnerGdTitle"
      | "scoringTierWinnerTitle"
      | "scoringTierMissTitle";
    detailKey:
      | "scoringTierExactDetail"
      | "scoringTierWinnerGdDetail"
      | "scoringTierWinnerDetail"
      | "scoringTierMissDetail";
    Icon: React.ComponentType<{ className?: string }>;
    accent: "pitch" | "flag" | "muted" | "ghost";
  }> = [
    { pts: 5, titleKey: "scoringTierExactTitle", detailKey: "scoringTierExactDetail", Icon: TargetIcon, accent: "pitch" },
    { pts: 3, titleKey: "scoringTierWinnerGdTitle", detailKey: "scoringTierWinnerGdDetail", Icon: ZapIcon, accent: "flag" },
    { pts: 1, titleKey: "scoringTierWinnerTitle", detailKey: "scoringTierWinnerDetail", Icon: TrophyIcon, accent: "muted" },
    { pts: 0, titleKey: "scoringTierMissTitle", detailKey: "scoringTierMissDetail", Icon: ArrowRightIcon, accent: "ghost" },
  ];

  return (
    <section
      id="scoring"
      className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("scoringEyebrow")}
          </p>
          <h2
            className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ fontStretch: "condensed" }}
          >
            {t("scoringHeadline")}
          </h2>
        </div>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground sm:text-right">
          {t("scoringSubtitle")}
        </p>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {scoringTiers.map((tier, i) => {
          const accentRing =
            tier.accent === "pitch"
              ? "ring-pitch/40"
              : tier.accent === "flag"
                ? "ring-flag/50"
                : "ring-border";
          const accentBg =
            tier.accent === "pitch"
              ? "bg-pitch text-pitch-foreground"
              : tier.accent === "flag"
                ? "bg-flag text-flag-foreground"
                : tier.accent === "muted"
                  ? "bg-muted text-muted-foreground"
                  : "bg-secondary text-muted-foreground/80";
          return (
            <li
              key={tier.pts}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-xl bg-card p-5 ring-1 transition-shadow hover:shadow-lg",
                accentRing,
              )}
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "grid size-9 place-items-center rounded-md",
                    accentBg,
                  )}
                >
                  <tier.Icon className="size-4" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} / 04
                </span>
              </div>
              <div className="mt-8">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-5xl font-semibold leading-none tracking-tight tabular-nums">
                    {tier.pts}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {t("scoringPts")}
                  </span>
                </div>
                <div className="mt-2 font-heading text-base font-semibold tracking-tight">
                  {t(tier.titleKey)}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(tier.detailKey)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-sm text-muted-foreground">
        {t("scoringFootnote")}{" "}
        <Link
          href={localePath(locale, "/how-it-works")}
          className="font-medium text-foreground underline underline-offset-4 hover:text-pitch"
        >
          {t("scoringFootnoteLink")}
        </Link>
        .
      </p>
    </section>
  );
}

function Cadence({ t }: { t: T }) {
  const items: Array<{
    tag: string;
    labelKey:
      | "cadencePickLabel"
      | "cadenceLockLabel"
      | "cadenceScoreLabel"
      | "cadenceClimbLabel";
    copyKey:
      | "cadencePickCopy"
      | "cadenceLockCopy"
      | "cadenceScoreCopy"
      | "cadenceClimbCopy";
  }> = [
    { tag: "01", labelKey: "cadencePickLabel", copyKey: "cadencePickCopy" },
    { tag: "02", labelKey: "cadenceLockLabel", copyKey: "cadenceLockCopy" },
    { tag: "03", labelKey: "cadenceScoreLabel", copyKey: "cadenceScoreCopy" },
    { tag: "04", labelKey: "cadenceClimbLabel", copyKey: "cadenceClimbCopy" },
  ];

  return (
    <section className="border-t border-border/70 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("cadenceEyebrow")}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("cadenceTrail")}
          </p>
        </div>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((step) => (
            <li
              key={step.tag}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  {step.tag}
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-pitch">
                  {t(step.labelKey)}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t(step.copyKey)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FlagWallDivider() {
  return (
    <section
      aria-hidden="true"
      className="relative overflow-hidden border-y border-border/70 bg-muted/30"
    >
      <div className="bg-grain pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, var(--background) 0%, transparent 12%, transparent 88%, var(--background) 100%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-12">
        <TeamFlagWall className="opacity-60 dark:opacity-40" />
      </div>
    </section>
  );
}
