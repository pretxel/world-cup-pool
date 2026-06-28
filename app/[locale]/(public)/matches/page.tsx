import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { MatchDaySection } from "@/components/match-day-section";
import { MatchLockCountdown } from "@/components/match-lock-countdown";
import { MatchStateBadge } from "@/components/match-state-badge";
import { MatchStatusFilter } from "@/components/match-status-filter";
import { MatchTeamFilter } from "@/components/match-team-filter";
import { NeedsPickToggle } from "@/components/needs-pick-toggle";
import { PendingPicksNudge } from "@/components/pending-picks-nudge";
import { TeamFlag } from "@/components/team-flag";
import {
  dayKeyForTimeZone,
  filterableTeams,
  formatDayKeyLabel,
  isClosingSoon,
  isConfirmedMatch,
  isLocked,
  matchInvolvesTeam,
  needsPick,
  parsePicksParam,
  parseRoundParam,
  parseStatusParam,
  parseTeamParam,
  reconcileSelectedTeams,
  soonestPickableMatch,
  stagesPresent,
  statusBucket,
} from "@/lib/match-utils";
import { persistTimeZoneForCurrentUser, readTimeZoneCookie } from "@/lib/timezone";
import { TimezoneSync } from "@/components/timezone-sync";
import { MatchRoundFilter } from "@/components/match-round-filter";
import { maybeScheduleOpportunisticSync } from "@/lib/result-sync/opportunistic";
import { getActiveCompetition } from "@/lib/competition";
import {
  getStageLabel,
  revealedKnockoutStageKeys,
  sortedStages,
} from "@/lib/competition-schema";
import type { MatchRow } from "@/lib/db";
import { CheckCircle2Icon, ChevronRightIcon, MapPinIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const ROW_STAGGER_MS = 20;
const ROW_STAGGER_CAP_MS = 800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "matches" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/matches" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/matches",
      type: "website",
    },
  };
}

type MatchUiStatus = "scheduled" | "locked" | "live" | "final" | "cancelled";

function uiStatusFor(m: MatchRow): MatchUiStatus {
  if (m.status === "live") return "live";
  if (m.status === "final") return "final";
  if (m.status === "cancelled") return "cancelled";
  return isLocked(m) ? "locked" : "scheduled";
}

export default async function MatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    team?: string | string[];
    status?: string | string[];
    picks?: string | string[];
    round?: string | string[];
  }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const {
    team: teamParam,
    status: statusParam,
    picks: picksParam,
    round: roundParam,
  } = await searchParams;

  const t = await getTranslations("matches");
  const activeCompetition = await getActiveCompetition();
  const format = activeCompetition?.format ?? null;

  const supabase = await createServerSupabaseClient();
  const { data: matches, error } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });

  if (error) {
    // Log the raw cause server-side for diagnostics; never surface exception
    // text to the user (WCAG-friendly, trust-preserving error state).
    console.error("[matches] load failed:", error.message);
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div
          role="alert"
          className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center"
        >
          <h1 className="text-foreground text-lg font-semibold">{t("loadFailedTitle")}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{t("loadFailedBody")}</p>
          <a
            href={localePath(locale, "/matches")}
            className="bg-primary text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-background mt-5 inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {t("loadFailedRetry")}
          </a>
        </div>
      </main>
    );
  }

  // Public visibility: a fixture shows when it is confirmed (both teams real)
  // OR its knockout round has been revealed by an admin. Revealed rounds let
  // players see the upcoming schedule (date/venue/placeholders) before teams
  // are confirmed; such rows render read-only and stay unpickable (the pick
  // gate is still confirmation). Everything below (filter, stats, day groups)
  // operates on this visible base.
  const revealedStages = format ? revealedKnockoutStageKeys(format) : new Set<string>();
  const list = ((matches ?? []) as MatchRow[]).filter(
    (m) => isConfirmedMatch(m) || revealedStages.has(m.stage),
  );

  // Safety net for the daily cron: if a kicked-off match still has no result
  // hours later, run a result sync after this response is sent. Costs the
  // render an in-memory scan only; debounced inside.
  maybeScheduleOpportunisticSync(list);

  // Only signed-in requests pay for the per-user pick lookup; anonymous
  // visitors get the list unchanged. RLS (predictions_select_own) scopes the
  // read to the current user.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let pickedIds = new Set<string>();
  if (user) {
    const { data: picks } = await supabase
      .from("predictions")
      .select("match_id")
      .eq("user_id", user.id);
    pickedIds = new Set((picks ?? []).map((p) => p.match_id));
  }

  // Ephemeral URL-driven filters, applied confirmed → team → status → picks.
  // Unknown param values are dropped so a bad URL falls back to "show
  // everything" rather than erroring.
  const availableTeams = filterableTeams(list);
  const selectedTeams = reconcileSelectedTeams(parseTeamParam(teamParam), availableTeams);
  const selectedKeys = new Set(selectedTeams.map((team) => team.toLowerCase()));
  const teamFiltered = list.filter((m) => matchInvolvesTeam(m, selectedKeys));

  // Round (stage) filter options: the rounds present in the visible list, in the
  // competition format's stage order, labeled with localized stage names. A
  // `?round=` value not among them falls back to "All rounds".
  const present = stagesPresent(list);
  const roundOptions = format
    ? sortedStages(format)
        .filter((s) => present.has(s.key))
        .map((s) => ({ key: s.key, label: getStageLabel(format, s.key, locale) }))
    : [];
  const parsedRound = parseRoundParam(roundParam);
  const selectedRound = parsedRound && present.has(parsedRound) ? parsedRound : null;

  // The round filter joins the team filter in the "scoped" set that feeds the
  // header stats and the needs-pick count, so those reflect the selected round.
  const scoped = selectedRound
    ? teamFiltered.filter((m) => m.stage === selectedRound)
    : teamFiltered;

  // Stats and the needs-pick count come from the scoped (team + round) set
  // BEFORE the status/picks filters, so each control shows what activating it
  // would yield (clicking "Live · 3" can never produce an empty list).
  const stats = {
    upcoming: scoped.filter((m) => statusBucket(m) === "upcoming").length,
    live: scoped.filter((m) => statusBucket(m) === "live").length,
    final: scoped.filter((m) => statusBucket(m) === "final").length,
  };

  const statusFilter = parseStatusParam(statusParam);
  // Default (no status filter): hide finished fixtures (final/cancelled) so the
  // list leads with what's still actionable; the `final` card opts them back in.
  const statusFiltered = statusFilter
    ? scoped.filter((m) => statusBucket(m) === statusFilter)
    : scoped.filter((m) => {
        const bucket = statusBucket(m);
        return bucket !== "final" && bucket !== "cancelled";
      });

  // The picks filter exists only for signed-in users; an anonymous request
  // carrying `?picks=needed` is silently ignored.
  const picksNeeded = user != null && parsePicksParam(picksParam);
  const needsPickCount = user ? scoped.filter((m) => needsPick(m, pickedIds)).length : 0;
  const filtered = picksNeeded
    ? statusFiltered.filter((m) => needsPick(m, pickedIds))
    : statusFiltered;

  const isFiltered =
    selectedTeams.length > 0 ||
    statusFilter !== null ||
    picksNeeded ||
    selectedRound !== null;

  // Default view is empty only because every in-scope fixture is finished:
  // guide to the Final filter instead of the generic "no matches" state.
  const allFinishedDefault = !isFiltered && filtered.length === 0 && stats.final > 0;

  // First-pick lead state (QW8): a signed-in user who has made zero picks and
  // has no filter active gets an inviting nudge toward the soonest still-open
  // fixture. It sits above the list (additive, never a takeover). When nothing
  // is currently pickable we fall back to encouraging copy instead of a CTA.
  const showFirstPick = user != null && pickedIds.size === 0 && !isFiltered;
  const firstPickMatch = showFirstPick ? soonestPickableMatch(list, pickedIds) : null;

  // Group by the visitor's local calendar day so each match sits under the day
  // its displayed local kickoff falls on. The timezone comes from the `tz`
  // cookie (set client-side by <TimezoneSync/>); until it's known we key by UTC
  // for a deterministic first render. Source order is kickoff_at ASC, so the
  // Map's insertion order keeps the day sections chronological.
  const timeZone = await readTimeZoneCookie();
  // Best-effort: mirror the detected zone onto the signed-in user's profile so
  // the reminder crons can bucket them to ~7am local. Never blocks the render.
  await persistTimeZoneForCurrentUser(timeZone);
  const dayKey = dayKeyForTimeZone(timeZone);
  const byDay = new Map<string, MatchRow[]>();
  for (const m of filtered) {
    const key = dayKey(m.kickoff_at);
    const arr = byDay.get(key) ?? [];
    arr.push(m);
    byDay.set(key, arr);
  }

  const dayEntries = [...byDay.entries()];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <TimezoneSync />
      <header className="border-border mb-8 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground font-mono text-[11px] tracking-[0.24em] uppercase">
            {t("eyebrow")}
          </p>
          <h1
            className="font-heading mt-1 text-4xl font-semibold tracking-tight sm:text-5xl"
            style={{ fontStretch: "condensed" }}
          >
            {t("headline")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">
            {t("lede", { total: filtered.length })}
          </p>
        </div>
        <Suspense fallback={null}>
          <MatchStatusFilter
            counts={stats}
            active={statusFilter}
            labels={{
              upcoming: t("statUpcoming"),
              live: t("statLive"),
              final: t("statFinal"),
            }}
            groupLabel={t("filterStatusLabel")}
          />
        </Suspense>
      </header>

      {user != null && needsPickCount > 0 && !picksNeeded ? (
        <div className="mb-4">
          <Suspense fallback={null}>
            <PendingPicksNudge
              count={needsPickCount}
              message={t("pendingPicksNudge", { count: needsPickCount })}
              actionLabel={t("pendingPicksNudgeAction")}
              dismissLabel={t("pendingPicksNudgeDismiss")}
            />
          </Suspense>
        </div>
      ) : null}

      {user ? (
        <div className="mb-4">
          <Suspense fallback={null}>
            <NeedsPickToggle
              count={needsPickCount}
              active={picksNeeded}
              label={t("filterNeedsPick")}
            />
          </Suspense>
        </div>
      ) : null}

      {roundOptions.length > 1 ? (
        <Suspense fallback={null}>
          <MatchRoundFilter
            rounds={roundOptions}
            selected={selectedRound}
            allLabel={t("filterAllRounds")}
            label={t("filterRoundLabel")}
          />
        </Suspense>
      ) : null}

      {availableTeams.length > 0 ? (
        <Suspense fallback={null}>
          <MatchTeamFilter
            teams={availableTeams}
            selected={selectedTeams}
            allLabel={t("filterAll")}
            label={t("filterLabel")}
          />
        </Suspense>
      ) : null}

      {showFirstPick ? (
        <div className="border-border bg-muted/30 mb-8 rounded-xl border border-dashed p-6 text-center sm:p-8">
          <p className="text-muted-foreground font-mono text-[11px] tracking-[0.24em] uppercase">
            {t("firstPick.eyebrow")}
          </p>
          {firstPickMatch ? (
            <>
              <p className="font-heading mx-auto mt-2 max-w-sm text-2xl font-semibold tracking-tight">
                {t("firstPick.title")}
              </p>
              <Link
                href={localePath(locale, `/matches/${firstPickMatch.id}`)}
                className="border-border bg-card font-heading text-foreground hover:bg-muted/50 focus-visible:ring-ring mt-4 inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {t("firstPick.cta", {
                  home: firstPickMatch.home_team,
                  away: firstPickMatch.away_team,
                })}
                <ChevronRightIcon className="size-4" aria-hidden />
              </Link>
            </>
          ) : (
            <>
              <p className="font-heading mx-auto mt-2 max-w-sm text-2xl font-semibold tracking-tight">
                {t("firstPick.noneTitle")}
              </p>
              <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
                {t("firstPick.noneBody")}
              </p>
            </>
          )}
        </div>
      ) : null}

      <div className="space-y-12">
        {dayEntries.map(([day, dayMatches], idx) => {
          // A day defaults to collapsed only once every fixture in it is done
          // (final or cancelled); any day still holding a scheduled, locked, or
          // live match defaults to expanded. The client shell overrides this
          // with the user's stored per-day choice after mount.
          const dayDone = dayMatches.every((m) => m.status === "final" || m.status === "cancelled");
          return (
            <MatchDaySection
              key={day}
              dayKey={day}
              defaultOpen={!dayDone}
              matchday={t("matchday", { n: String(idx + 1).padStart(2, "0") })}
              dateNode={formatDayKeyLabel(day, locale)}
              countLabel={t("matchCount", { count: dayMatches.length })}
              expandLabel={t("dayExpand")}
              collapseLabel={t("dayCollapse")}
            >
              <ul className="border-border bg-card overflow-hidden rounded-xl border">
                {dayMatches.map((m, i) => {
                  const delay = Math.min(i * ROW_STAGGER_MS, ROW_STAGGER_CAP_MS);
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        i !== 0 && "border-border border-t",
                        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-300",
                      )}
                      style={{ animationDelay: `${delay}ms` }}
                    >
                      <MatchRowCard
                        match={m}
                        uiStatus={uiStatusFor(m)}
                        locale={locale}
                        tStage={format ? getStageLabel(format, m.stage, locale) : m.stage}
                        tKickoff={t("rowKickoff")}
                        tFinal={t("rowFinal")}
                        tOnNow={t("rowOnNow")}
                        tLocked={t("rowLocked")}
                        tPick={t("rowPick")}
                        tClosesIn={t("rowClosesIn", { time: "{time}" })}
                        picked={pickedIds.has(m.id)}
                        tPicked={t("rowPicked")}
                        confirmed={isConfirmedMatch(m)}
                        tTbd={t("rowTeamsTbd")}
                      />
                    </li>
                  );
                })}
              </ul>
            </MatchDaySection>
          );
        })}

        {filtered.length === 0 ? (
          <div className="border-border bg-muted/30 rounded-xl border border-dashed p-10 text-center">
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.24em] uppercase">
              {picksNeeded
                ? t("needsPickEmptyTitle")
                : isFiltered
                  ? t("filterEmptyTitle")
                  : allFinishedDefault
                    ? t("allFinishedTitle")
                    : t("emptyTitle")}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm">
              {picksNeeded
                ? t("needsPickEmptyBody")
                : isFiltered
                  ? t("filterEmptyBody")
                  : allFinishedDefault
                    ? t("allFinishedBody")
                    : t("emptyBody")}
            </p>
            {isFiltered || allFinishedDefault ? (
              <Link
                href={localePath(locale, allFinishedDefault ? "/matches?status=final" : "/matches")}
                className="border-border bg-card font-heading text-foreground hover:bg-muted/50 focus-visible:ring-ring mt-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {picksNeeded
                  ? t("needsPickEmptyAction")
                  : allFinishedDefault
                    ? t("allFinishedAction")
                    : t("filterClear")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function MatchRowCard({
  match,
  uiStatus,
  locale,
  tStage,
  tKickoff,
  tFinal,
  tOnNow,
  tLocked,
  tPick,
  tClosesIn,
  picked,
  tPicked,
  confirmed,
  tTbd,
}: {
  match: MatchRow;
  uiStatus: MatchUiStatus;
  locale: Locale;
  tStage: string;
  tKickoff: string;
  tFinal: string;
  tOnNow: string;
  tLocked: string;
  tPick: string;
  tClosesIn: string;
  picked: boolean;
  tPicked: string;
  confirmed: boolean;
  tTbd: string;
}) {
  const finalKnown =
    match.status === "final" && match.home_score != null && match.away_score != null;

  // A scheduled, unpicked fixture becomes a "closing soon" candidate. Only a
  // confirmed fixture is pickable — a revealed-but-unconfirmed knockout row is
  // read-only (schedule only), so it never shows the Pick/closing-soon affordance.
  const pickable = uiStatus === "scheduled" && !picked && confirmed;
  const closingSoon = pickable && isClosingSoon(match.kickoff_at);

  // Accessible name for the whole-row link: lead with the action when the match
  // is pickable so screen-reader users hear "Pick: Algeria – Austria", otherwise
  // a plain "view" name. Keeps the link's name concise vs. its inner text.
  const rowAriaLabel = pickable
    ? `${tPick}: ${match.home_team} – ${match.away_team}`
    : `${match.home_team} – ${match.away_team}`;

  return (
    <Link
      href={localePath(locale, `/matches/${match.id}`)}
      aria-label={rowAriaLabel}
      className={cn(
        "group/match hover:bg-muted/50 focus-visible:ring-ring focus-visible:ring-inset relative flex items-center gap-3 px-4 py-3.5 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:gap-4 sm:px-5",
        // Subtle urgency accent, distinct from the live `live-pulse` and the
        // muted locked treatment: a warm inset ring + faint tint.
        closingSoon && "bg-flag/[0.06] ring-flag/30 ring-1 ring-inset",
      )}
    >
      <div className="flex w-auto shrink-0 flex-col items-start sm:w-14">
        <span className="text-muted-foreground hidden font-mono text-[10px] tracking-[0.18em] uppercase sm:block">
          {tKickoff}
        </span>
        <span className="text-foreground font-mono text-sm font-semibold tabular-nums">
          <LocalTime iso={match.kickoff_at} format="time" />
        </span>
      </div>

      <div aria-hidden className="bg-border hidden h-10 w-px sm:block" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="border-border bg-secondary text-muted-foreground rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.16em] uppercase">
            {tStage}
            {match.group_code ? ` · ${match.group_code}` : ""}
          </span>
          <MatchStateBadge status={uiStatus} size="sm" />
          {picked ? (
            <span className="border-pitch/40 bg-pitch/10 text-pitch inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.16em] uppercase">
              <CheckCircle2Icon className="size-3" aria-hidden />
              {tPicked}
            </span>
          ) : null}
        </div>
        <div className="font-heading text-foreground mt-1.5 flex min-w-0 flex-col gap-1 text-base font-semibold tracking-tight sm:flex-row sm:items-center sm:gap-2 sm:text-lg">
          <span className="flex min-w-0 items-center gap-2">
            <TeamFlag team={match.home_team} size="sm" />
            <span className="truncate">{match.home_team}</span>
          </span>
          <span className="text-muted-foreground hidden text-xs font-medium tracking-[0.18em] uppercase sm:inline">
            vs
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <TeamFlag team={match.away_team} size="sm" />
            <span className="truncate">{match.away_team}</span>
          </span>
        </div>
        {match.venue ? (
          <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
            <MapPinIcon className="size-3" aria-hidden />
            <span className="truncate">{match.venue}</span>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 text-right">
        {!confirmed ? (
          <div className="text-muted-foreground hidden font-mono text-[10px] tracking-[0.2em] uppercase sm:block">
            {tTbd}
          </div>
        ) : finalKnown ? (
          <div>
            <div className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
              {tFinal}
            </div>
            <div className="text-foreground font-mono text-xl font-semibold tabular-nums">
              {match.home_score}–{match.away_score}
            </div>
          </div>
        ) : uiStatus === "live" ? (
          <div className="text-destructive live-pulse hidden font-mono text-[10px] tracking-[0.2em] uppercase sm:block">
            {tOnNow}
          </div>
        ) : uiStatus === "locked" ? (
          <div className="text-muted-foreground hidden font-mono text-[10px] tracking-[0.2em] uppercase sm:block">
            {tLocked}
          </div>
        ) : pickable ? (
          // Open & unpicked: one client island owns the trailing affordance. It
          // shows the static "Pick" label until kickoff is within the lead
          // window, the "closes in mm:ss" badge while imminent, and the locked
          // label at kickoff — updating in place as the clock crosses each
          // boundary, no reload.
          <MatchLockCountdown
            kickoffAt={match.kickoff_at}
            closesInTemplate={tClosesIn}
            lockedNode={
              <span className="text-muted-foreground hidden font-mono text-[10px] tracking-[0.2em] uppercase sm:inline">
                {tLocked}
              </span>
            }
            pickNode={
              <span className="bg-pitch text-pitch-foreground inline-flex items-center rounded-full px-3 py-1.5 font-heading text-xs font-semibold tracking-tight">
                {tPick}
              </span>
            }
          />
        ) : (
          <div className="text-muted-foreground hidden font-mono text-[10px] tracking-[0.2em] uppercase sm:block">
            {tPick}
          </div>
        )}
        <ChevronRightIcon
          aria-hidden
          className="text-muted-foreground/60 group-hover/match:text-foreground size-4 shrink-0 transition-transform group-hover/match:translate-x-0.5"
        />
      </div>
    </Link>
  );
}
