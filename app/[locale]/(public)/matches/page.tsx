import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { MatchDaySection } from "@/components/match-day-section";
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
  isConfirmedMatch,
  isLocked,
  matchInvolvesTeam,
  needsPick,
  parsePicksParam,
  parseStatusParam,
  parseTeamParam,
  reconcileSelectedTeams,
  soonestPickableMatch,
  statusBucket,
} from "@/lib/match-utils";
import { readTimeZoneCookie } from "@/lib/timezone";
import { TimezoneSync } from "@/components/timezone-sync";
import { maybeScheduleOpportunisticSync } from "@/lib/result-sync/opportunistic";
import { getActiveCompetition } from "@/lib/competition";
import { getStageLabel } from "@/lib/competition-schema";
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
  }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const {
    team: teamParam,
    status: statusParam,
    picks: picksParam,
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
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t("loadFailed", { message: error.message })}
        </div>
      </main>
    );
  }

  // Public visibility is gated to confirmed matches: knockout fixtures hold
  // placeholder participants ("2nd Group A") until an admin sets the real
  // teams, and an unknown matchup is neither readable nor pickable. Everything
  // below (filter, stats, day groups) operates on this confirmed base.
  const list = ((matches ?? []) as MatchRow[]).filter(isConfirmedMatch);

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
  const selectedTeams = reconcileSelectedTeams(
    parseTeamParam(teamParam),
    availableTeams,
  );
  const selectedKeys = new Set(selectedTeams.map((team) => team.toLowerCase()));
  const teamFiltered = list.filter((m) => matchInvolvesTeam(m, selectedKeys));

  // Stats and the needs-pick count come from the team-filtered set BEFORE the
  // status/picks filters, so each control shows what activating it would
  // yield (clicking "Live · 3" can never produce an empty list).
  const stats = {
    upcoming: teamFiltered.filter((m) => statusBucket(m) === "upcoming").length,
    live: teamFiltered.filter((m) => statusBucket(m) === "live").length,
    final: teamFiltered.filter((m) => statusBucket(m) === "final").length,
  };

  const statusFilter = parseStatusParam(statusParam);
  const statusFiltered = statusFilter
    ? teamFiltered.filter((m) => statusBucket(m) === statusFilter)
    : teamFiltered;

  // The picks filter exists only for signed-in users; an anonymous request
  // carrying `?picks=needed` is silently ignored.
  const picksNeeded = user != null && parsePicksParam(picksParam);
  const needsPickCount = user
    ? teamFiltered.filter((m) => needsPick(m, pickedIds)).length
    : 0;
  const filtered = picksNeeded
    ? statusFiltered.filter((m) => needsPick(m, pickedIds))
    : statusFiltered;

  const isFiltered =
    selectedTeams.length > 0 || statusFilter !== null || picksNeeded;

  // First-pick lead state (QW8): a signed-in user who has made zero picks and
  // has no filter active gets an inviting nudge toward the soonest still-open
  // fixture. It sits above the list (additive, never a takeover). When nothing
  // is currently pickable we fall back to encouraging copy instead of a CTA.
  const showFirstPick = user != null && pickedIds.size === 0 && !isFiltered;
  const firstPickMatch = showFirstPick
    ? soonestPickableMatch(list, pickedIds)
    : null;

  // Group by the visitor's local calendar day so each match sits under the day
  // its displayed local kickoff falls on. The timezone comes from the `tz`
  // cookie (set client-side by <TimezoneSync/>); until it's known we key by UTC
  // for a deterministic first render. Source order is kickoff_at ASC, so the
  // Map's insertion order keeps the day sections chronological.
  const timeZone = await readTimeZoneCookie();
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
      <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
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
        <div className="mb-8 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("firstPick.eyebrow")}
          </p>
          {firstPickMatch ? (
            <>
              <p className="mx-auto mt-2 max-w-sm font-heading text-2xl font-semibold tracking-tight">
                {t("firstPick.title")}
              </p>
              <Link
                href={localePath(locale, `/matches/${firstPickMatch.id}`)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 font-heading text-sm font-medium tracking-tight text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <p className="mx-auto mt-2 max-w-sm font-heading text-2xl font-semibold tracking-tight">
                {t("firstPick.noneTitle")}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
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
          const dayDone = dayMatches.every(
            (m) => m.status === "final" || m.status === "cancelled",
          );
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
              <ul className="overflow-hidden rounded-xl border border-border bg-card">
                {dayMatches.map((m, i) => {
                  const delay = Math.min(i * ROW_STAGGER_MS, ROW_STAGGER_CAP_MS);
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        i !== 0 && "border-t border-border",
                        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:fill-mode-both",
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
                        picked={pickedIds.has(m.id)}
                        tPicked={t("rowPicked")}
                      />
                    </li>
                  );
                })}
              </ul>
            </MatchDaySection>
          );
        })}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {picksNeeded
                ? t("needsPickEmptyTitle")
                : isFiltered
                  ? t("filterEmptyTitle")
                  : t("emptyTitle")}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm">
              {picksNeeded
                ? t("needsPickEmptyBody")
                : isFiltered
                  ? t("filterEmptyBody")
                  : t("emptyBody")}
            </p>
            {isFiltered ? (
              <Link
                href={localePath(locale, "/matches")}
                className="mt-4 inline-flex items-center rounded-full border border-border bg-card px-3 py-1 font-heading text-xs font-medium tracking-tight text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {picksNeeded ? t("needsPickEmptyAction") : t("filterClear")}
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
  picked,
  tPicked,
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
  picked: boolean;
  tPicked: string;
}) {
  const finalKnown =
    match.status === "final" &&
    match.home_score != null &&
    match.away_score != null;

  return (
    <Link
      href={localePath(locale, `/matches/${match.id}`)}
      className="group/match relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:gap-4"
    >
      <div className="flex w-auto shrink-0 flex-col items-start sm:w-14">
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
          {tKickoff}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
          <LocalTime iso={match.kickoff_at} format="time" />
        </span>
      </div>

      <div aria-hidden className="hidden h-10 w-px bg-border sm:block" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-sm border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {tStage}
            {match.group_code ? ` · ${match.group_code}` : ""}
          </span>
          <MatchStateBadge status={uiStatus} size="sm" />
          {picked ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-pitch/40 bg-pitch/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-pitch">
              <CheckCircle2Icon className="size-3" aria-hidden />
              {tPicked}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex min-w-0 flex-col gap-1 font-heading text-base font-semibold tracking-tight text-foreground sm:flex-row sm:items-center sm:gap-2 sm:text-lg">
          <span className="flex min-w-0 items-center gap-2">
            <TeamFlag team={match.home_team} size="sm" />
            <span className="truncate">{match.home_team}</span>
          </span>
          <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            vs
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <TeamFlag team={match.away_team} size="sm" />
            <span className="truncate">{match.away_team}</span>
          </span>
        </div>
        {match.venue ? (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPinIcon className="size-3" aria-hidden />
            <span className="truncate">{match.venue}</span>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 text-right">
        {finalKnown ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {tFinal}
            </div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
              {match.home_score}–{match.away_score}
            </div>
          </div>
        ) : uiStatus === "live" ? (
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-destructive live-pulse sm:block">
            {tOnNow}
          </div>
        ) : uiStatus === "locked" ? (
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:block">
            {tLocked}
          </div>
        ) : (
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:block">
            {tPick}
          </div>
        )}
        <ChevronRightIcon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover/match:translate-x-0.5 group-hover/match:text-foreground"
        />
      </div>
    </Link>
  );
}
