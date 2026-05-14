import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { MatchStateBadge } from "@/components/match-state-badge";
import { KickoffCountdown } from "@/components/kickoff-countdown";
import { buttonVariants } from "@/components/ui/button";
import { TeamFlag } from "@/components/team-flag";
import { StageIcon } from "@/components/stage-icon";
import { VenueImage } from "@/components/venue-image";
import { lockReason, stageLabel } from "@/lib/match-utils";
import { ArrowLeftIcon, LockIcon, MapPinIcon } from "lucide-react";
import { PredictionForm } from "./prediction-form";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}): Promise<Metadata> {
  const { matchId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: match } = await supabase
    .from("matches")
    .select("home_team, away_team, kickoff_at, venue, stage")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) {
    return {
      title: "Match not found",
      description: "This match is not in the World Cup 2026 Pool fixture list.",
      robots: { index: false, follow: false },
    };
  }

  const kickoff = new Date(match.kickoff_at);
  const kickoffLabel = kickoff.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const title = `${match.home_team} vs ${match.away_team}`;
  const description = match.venue
    ? `Predict ${match.home_team} vs ${match.away_team} at ${match.venue}. Kickoff ${kickoffLabel} UTC. Submit your score before the match locks.`
    : `Predict ${match.home_team} vs ${match.away_team}. Kickoff ${kickoffLabel} UTC. Submit your score before the match locks.`;
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
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
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

  const reason = lockReason(match);
  const locked = reason !== null;
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
    ...(match.venue
      ? { location: { "@type": "Place", name: match.venue } }
      : {}),
    description: `${stageLabel(match.stage)}${
      match.group_code ? ` · ${match.group_code}` : ""
    }: ${match.home_team} vs ${match.away_team}.`,
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }}
      />

      <Link
        href="/matches"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        All matches
      </Link>

      {/* Scoreboard panel */}
      <section
        aria-label="Match scoreboard"
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
              {stageLabel(match.stage)}
              {match.group_code ? ` · ${match.group_code}` : ""}
            </span>
            <span
              className={cn(
                match.status === "live" &&
                  "motion-safe:animate-pulse",
              )}
            >
              <MatchStateBadge status={uiStatus} size="sm" />
            </span>
          </div>
        </div>

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 pt-3 pb-6 sm:gap-6 sm:px-8">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/70">
              Home
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
                  vs
                </div>
                <div className="mt-1 font-heading text-2xl font-semibold leading-none sm:text-4xl">
                  —
                </div>
              </>
            )}
          </div>

          <div className="min-w-0 text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/70">
              Away
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
              Kickoff{" "}
              <LocalTime iso={match.kickoff_at} />
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
              lockedLabel="Locked at kickoff"
            />
          ) : null}
        </div>
      </section>

      {/* Prediction zone */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2
            className="font-heading text-xl font-semibold tracking-tight"
            style={{ fontStretch: "condensed" }}
          >
            Your prediction
          </h2>
          {myPrediction && !isFinal ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Current pick:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {myPrediction.home_goals}–{myPrediction.away_goals}
              </span>
            </span>
          ) : null}
        </div>

        {!user ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-sm">
            <p>
              Sign in to lock a score for{" "}
              <span className="font-medium text-foreground">
                {match.home_team} vs {match.away_team}
              </span>
              . You can keep editing until kickoff.
            </p>
            <div>
              <Link
                href={`/sign-in?next=/matches/${match.id}`}
                className={buttonVariants({
                  size: "lg",
                  className:
                    "h-10 gap-2 px-4 text-sm font-semibold uppercase tracking-[0.16em]",
                })}
              >
                Sign in
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
                    Your pick was{" "}
                    <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                      {myPrediction.home_goals}–{myPrediction.away_goals}
                    </span>
                    . {lockedExplain(reason)}
                  </p>
                  {isFinal ? (
                    <p className="mt-1 text-muted-foreground">
                      Final score lives in the scoreboard above.
                    </p>
                  ) : null}
                </>
              ) : (
                missingPickExplain(reason)
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
    </main>
  );
}

function lockedExplain(reason: ReturnType<typeof lockReason>): string {
  switch (reason) {
    case "final":
      return "This match is final — predictions are locked.";
    case "cancelled":
      return "This match was cancelled — predictions are locked.";
    case "live":
      return "This match is live — predictions are locked.";
    case "kickoff":
    default:
      return "Predictions are locked at kickoff.";
  }
}

function missingPickExplain(reason: ReturnType<typeof lockReason>): string {
  switch (reason) {
    case "final":
      return "This match is final and you didn't submit a prediction.";
    case "cancelled":
      return "This match was cancelled — no predictions can be submitted.";
    case "live":
      return "This match is live — predictions are locked and you didn't submit one.";
    case "kickoff":
    default:
      return "Predictions are locked — kickoff has passed and you didn't submit one for this match.";
  }
}
