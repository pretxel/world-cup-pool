import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { MatchStateBadge } from "@/components/match-state-badge";
import { KickoffCountdown } from "@/components/kickoff-countdown";
import { buttonVariants } from "@/components/ui/button";
import { TeamFlag } from "@/components/team-flag";
import { StageIcon } from "@/components/stage-icon";
import { VenueImage } from "@/components/venue-image";
import { isConfirmedMatch, lockReason } from "@/lib/match-utils";
import type { MatchStage } from "@/lib/db";
import { ArrowLeftIcon, LockIcon, MapPinIcon } from "lucide-react";
import { PredictionForm } from "./prediction-form";
import { SharePickButtons } from "@/components/share-pick-buttons";
import { buildPickSharePath } from "@/lib/share";
import { env } from "@/lib/env";
import { GroupStandingsTable } from "@/components/group-standings-table";
import { simulateGroup, type GroupTeamRow } from "@/lib/group-standings";
import { cn } from "@/lib/utils";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const STAGE_KEYS: Record<MatchStage, keyof IntlMessages["stages"]> = {
  group: "group",
  r32: "r32",
  r16: "r16",
  qf: "qf",
  sf: "sf",
  third: "third",
  final: "final",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; matchId: string }>;
}): Promise<Metadata> {
  const { locale, matchId } = await params;
  const t = await getTranslations({ locale, namespace: "matchDetail" });
  const supabase = await createServerSupabaseClient();
  const { data: match } = await supabase
    .from("matches")
    .select("home_team, away_team, kickoff_at, venue, stage")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) {
    return {
      title: t("metaTitleNotFound"),
      description: t("metaDescriptionNotFound"),
      robots: { index: false, follow: false },
    };
  }

  const kickoff = new Date(match.kickoff_at);
  const kickoffLabel = kickoff.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const title = `${match.home_team} vs ${match.away_team}`;
  const description = match.venue
    ? t("metaDescriptionWithVenue", {
        home: match.home_team,
        away: match.away_team,
        venue: match.venue,
        kickoff: kickoffLabel,
      })
    : t("metaDescription", {
        home: match.home_team,
        away: match.away_team,
        kickoff: kickoffLabel,
      });
  const canonical = `/matches/${matchId}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: `${title} · WC26 Pool`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · WC26 Pool`,
      description,
    },
  };
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ locale: string; matchId: string }>;
}) {
  const { locale: raw, matchId } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("matchDetail");
  const tStages = await getTranslations("stages");
  const tForm = await getTranslations("predictionForm");
  const tGroupSim = await getTranslations("groupSimulation");
  const tShare = await getTranslations("sharePick");

  const supabase = await createServerSupabaseClient();

  const { data: match, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (error || !match) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myPrediction: { home_goals: number; away_goals: number } | null = null;
  if (user) {
    const { data } = await supabase
      .from("predictions")
      .select("home_goals, away_goals")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .maybeSingle();
    myPrediction = data;
  }

  // Personal, prediction-only group table for this match's group. Built from
  // the viewer's own picks across the group's fixtures (real results are never
  // folded in). Only signed-in, group-stage matches get the section.
  let groupSim: GroupTeamRow[] | null = null;
  if (user && match.stage === "group" && match.group_code) {
    const { data: fixtures } = await supabase
      .from("matches")
      .select("id, home_team, away_team")
      .eq("stage", "group")
      .eq("group_code", match.group_code);
    const groupFixtures = fixtures ?? [];
    const predictionsByMatchId = new Map<
      string,
      { home_goals: number; away_goals: number }
    >();
    if (groupFixtures.length > 0) {
      const { data: groupPicks } = await supabase
        .from("predictions")
        .select("match_id, home_goals, away_goals")
        .eq("user_id", user.id)
        .in(
          "match_id",
          groupFixtures.map((f) => f.id),
        );
      for (const p of groupPicks ?? []) {
        predictionsByMatchId.set(p.match_id, {
          home_goals: p.home_goals,
          away_goals: p.away_goals,
        });
      }
    }
    groupSim = simulateGroup(groupFixtures, predictionsByMatchId);
  }

  const reason = lockReason(match);
  const locked = reason !== null;
  // Knockout fixtures stay unconfirmed (placeholder teams) until an admin sets
  // the real teams; an unconfirmed match is shown but not pickable.
  const confirmed = isConfirmedMatch(match);
  const uiStatus: "scheduled" | "locked" | "live" | "final" | "cancelled" =
    match.status === "live"
      ? "live"
      : match.status === "final"
        ? "final"
        : match.status === "cancelled"
          ? "cancelled"
          : locked
            ? "locked"
            : "scheduled";

  const isFinal =
    match.status === "final" &&
    match.home_score != null &&
    match.away_score != null;

  const stageLabelLocalized = tStages(STAGE_KEYS[match.stage as MatchStage]);

  const sportsEventJsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${match.home_team} vs ${match.away_team}`,
    sport: "Soccer",
    startDate: match.kickoff_at,
    eventStatus:
      match.status === "final"
        ? "https://schema.org/EventCompleted"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    competitor: [
      { "@type": "SportsTeam", name: match.home_team },
      { "@type": "SportsTeam", name: match.away_team },
    ],
    ...(match.venue ? { location: { "@type": "Place", name: match.venue } } : {}),
    description: `${stageLabelLocalized}${match.group_code ? ` · ${match.group_code}` : ""}: ${match.home_team} vs ${match.away_team}.`,
  };

  function missingPickExplain(): string {
    switch (reason) {
      case "final":
        return t("missingPickFinal");
      case "cancelled":
        return t("missingPickCancelled");
      case "live":
        return t("missingPickLive");
      case "kickoff":
      default:
        return t("missingPickKickoff");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }}
      />

      <Link
        href={localePath(locale, "/matches")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        {t("back")}
      </Link>

      <section
        aria-label={t("scoreboardLabel")}
        className="bg-scoreboard relative mt-5 overflow-hidden rounded-2xl text-pitch-foreground ring-1 ring-pitch/30 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:ease-out"
      >
        <VenueImage
          venue={match.venue}
          className="opacity-25 mix-blend-luminosity"
        />
        <div
          aria-hidden
          className="bg-pitch-stripes pointer-events-none absolute inset-0 opacity-[0.12]"
        />
        <div className="bg-grain pointer-events-none absolute inset-0" />

        <div className="relative px-6 pt-5 pb-2">
          <div className="flex flex-wrap items-center gap-2 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300 motion-safe:delay-100 motion-safe:fill-mode-both">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-pitch-foreground/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/80 ring-1 ring-pitch-foreground/15">
              <StageIcon stage={match.stage} className="size-3" />
              {stageLabelLocalized}
              {match.group_code ? ` · ${match.group_code}` : ""}
            </span>
            <span
              className={cn(match.status === "live" && "motion-safe:animate-pulse")}
            >
              <MatchStateBadge status={uiStatus} size="sm" />
            </span>
          </div>
        </div>

        <div className="relative flex flex-col gap-3 px-6 pt-3 pb-6 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6 sm:px-8">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/70">
              {t("home")}
            </div>
            <div className="mt-1 flex items-center gap-2 sm:gap-3">
              <TeamFlag team={match.home_team} size="lg" />
              <span
                className="min-w-0 truncate font-heading text-2xl font-semibold leading-tight sm:text-4xl"
                style={{ fontStretch: "condensed" }}
              >
                {match.home_team}
              </span>
            </div>
          </div>

          <div className="grid place-items-center">
            {isFinal ? (
              <div className="font-mono text-4xl font-semibold leading-none tabular-nums sm:text-6xl motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in motion-safe:duration-400 motion-safe:delay-200 motion-safe:fill-mode-both">
                {match.home_score}
                <span className="px-1 text-pitch-foreground/40">–</span>
                {match.away_score}
              </div>
            ) : (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/70">
                  {t("vs")}
                </div>
                <div className="mt-1 font-heading text-2xl font-semibold leading-none sm:text-4xl">
                  —
                </div>
              </>
            )}
          </div>

          <div className="min-w-0 text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/70">
              {t("away")}
            </div>
            <div className="mt-1 flex items-center justify-end gap-2 sm:gap-3">
              <span
                className="min-w-0 truncate font-heading text-2xl font-semibold leading-tight sm:text-4xl"
                style={{ fontStretch: "condensed" }}
              >
                {match.away_team}
              </span>
              <TeamFlag team={match.away_team} size="lg" />
            </div>
          </div>
        </div>

        <div className="relative flex flex-col gap-2 border-t border-pitch-foreground/15 bg-black/10 px-6 py-3 text-pitch-foreground/85 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
            <span>
              {t("kickoffLabel")} <LocalTime iso={match.kickoff_at} />
            </span>
            {match.venue ? (
              <span className="flex items-center gap-1 text-pitch-foreground/70">
                <MapPinIcon className="size-3" aria-hidden />
                {match.venue}
              </span>
            ) : null}
          </div>
          {!isFinal && uiStatus !== "cancelled" ? (
            <KickoffCountdown
              kickoffAt={match.kickoff_at}
              className="text-pitch-foreground/85"
              lockedLabel={tForm("lockedAtKickoff")}
            />
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2
            className="font-heading text-xl font-semibold tracking-tight"
            style={{ fontStretch: "condensed" }}
          >
            {t("predictionHeading")}
          </h2>
          {myPrediction && !isFinal ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {t.rich("currentPick", {
                home: () => (
                  <span className="font-semibold tabular-nums text-foreground">
                    {myPrediction.home_goals}
                  </span>
                ),
                away: () => (
                  <span className="font-semibold tabular-nums text-foreground">
                    {myPrediction.away_goals}
                  </span>
                ),
              })}
            </span>
          ) : null}
        </div>

        {!confirmed ? (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-5 text-sm">
            <LockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">{t("notConfirmedTitle")}</p>
              <p className="mt-1 text-muted-foreground">{t("notConfirmedBody")}</p>
            </div>
          </div>
        ) : !user ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-sm">
            <p>
              {t("signInPrompt", {
                home: match.home_team,
                away: match.away_team,
              })}
            </p>
            <div>
              <Link
                href={`${localePath(locale, "/sign-in")}?next=${encodeURIComponent(localePath(locale, `/matches/${match.id}`))}`}
                className={buttonVariants({
                  size: "lg",
                  className:
                    "h-10 gap-2 px-4 text-sm font-semibold uppercase tracking-[0.16em]",
                })}
              >
                {t("signInCta")}
              </Link>
            </div>
          </div>
        ) : locked ? (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-5 text-sm">
            <LockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              {myPrediction ? (
                <>
                  <p>
                    {t.rich(
                      reason === "final"
                        ? "lockedWithPickFinal"
                        : reason === "cancelled"
                          ? "lockedWithPickCancelled"
                          : reason === "live"
                            ? "lockedWithPickLive"
                            : "lockedWithPickKickoff",
                      {
                        home: () => (
                          <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                            {myPrediction.home_goals}
                          </span>
                        ),
                        away: () => (
                          <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                            {myPrediction.away_goals}
                          </span>
                        ),
                      },
                    )}
                  </p>
                  {isFinal ? (
                    <p className="mt-1 text-muted-foreground">
                      {t("finalFootnote")}
                    </p>
                  ) : null}
                </>
              ) : (
                missingPickExplain()
              )}
            </div>
          </div>
        ) : (
          <PredictionForm
            matchId={match.id}
            homeTeam={match.home_team}
            awayTeam={match.away_team}
            kickoffAt={match.kickoff_at}
            initial={myPrediction}
          />
        )}
      </section>

      {myPrediction ? (
        <section className="mt-8">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {tShare("heading")}
          </p>
          <SharePickButtons
            shareUrl={`${env.siteUrl}${buildPickSharePath(locale, match.id, myPrediction.home_goals, myPrediction.away_goals)}`}
            shareText={tShare("shareText", {
              home: match.home_team,
              away: match.away_team,
              h: myPrediction.home_goals,
              a: myPrediction.away_goals,
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

      {groupSim ? (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {tGroupSim("matchEyebrow")}
            </p>
            <Link
              href={localePath(locale, "/my-picks")}
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground underline-offset-4 hover:text-pitch hover:underline"
            >
              {tGroupSim("seeAllGroups")} →
            </Link>
          </div>
          <GroupStandingsTable
            groupCode={match.group_code ?? ""}
            rows={groupSim}
            highlightTeams={[match.home_team, match.away_team]}
          />
        </section>
      ) : null}
    </main>
  );
}
