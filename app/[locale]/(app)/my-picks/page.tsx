import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { MatchStateBadge } from "@/components/match-state-badge";
import { TeamFlag } from "@/components/team-flag";
import { PicksVsResults } from "@/components/picks-vs-results";
import { StandingCards } from "@/components/standing-cards";
import { StandingCardsTracker } from "@/components/standing-cards-tracker";
import { PicksVsResultsTracker } from "@/components/picks-vs-results-tracker";
import { PaginationControls } from "@/components/pagination-controls";
import { simulateAllGroups } from "@/lib/group-standings";
import { getStandingSummary } from "@/lib/standing-summary";
import { getGroupTables } from "@/lib/group-table";
import { getActiveCompetition } from "@/lib/competition";
import { groupStageKey } from "@/lib/competition-schema";
import { paginate, parsePageParam } from "@/lib/pagination";
import { sortPicksByKickoff } from "@/lib/picks-order";
import { isLocked } from "@/lib/match-utils";
import { computePredictionStreak } from "@/lib/prediction-streak";
import {
  resolveStreakFreeze,
  currentFreezeWeekBounds,
} from "@/lib/streak-freeze";
import { ArrowRightIcon, FlameIcon, PencilLineIcon, SnowflakeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "myPicks" });
  return { title: t("title") };
}

export default async function MyPicksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { locale: raw } = await params;
  const { page: pageParam } = await searchParams;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("myPicks");

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    redirect(
      `${localePath(locale, "/sign-in")}?next=${encodeURIComponent(localePath(locale, "/my-picks"))}`,
    );

  const { data: picks, error } = await supabase
    .from("predictions")
    .select("match_id, home_goals, away_goals, submitted_at, matches!inner(*)")
    .eq("user_id", user.id);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t("loadFailed", { message: error.message })}
        </div>
      </main>
    );
  }

  const { data: scores } = await supabase
    .from("scores")
    .select("match_id, points, hit_type")
    .eq("user_id", user.id);
  const scoreByMatch = new Map(scores?.map((s) => [s.match_id, s]) ?? []);

  const totalPoints = (scores ?? []).reduce((sum, s) => sum + (s.points ?? 0), 0);
  const exactCount = (scores ?? []).filter((s) => s.hit_type === "exact").length;

  // Prediction streak from the predictions already fetched above. A weekly
  // freeze pass can forgive a single one-day gap so the run survives the cliff.
  // The freeze helper lazily refills this week's allowance, consumes one freeze
  // if an eligible gap exists, and returns the consumed-freeze days fed into the
  // pure streak function. Best-effort: it never throws into the render.
  const now = new Date();
  const submittedAt = (picks ?? []).map((p) => p.submitted_at);
  const { start: weekStart, end: weekEnd } = currentFreezeWeekBounds(now);
  const weekActivityDays = new Set(
    submittedAt
      .map((iso) => new Date(iso))
      .filter((d) => d >= weekStart && d < weekEnd)
      .map((d) => d.toISOString().slice(0, 10)),
  );
  const freeze = await resolveStreakFreeze(
    supabase,
    user.id,
    "prediction",
    weekActivityDays,
    now,
    weekStart,
  );
  const streak = computePredictionStreak(submittedAt, now, freeze.frozenDays);

  // Simulated group stage from the user's own predictions. Fetch every group
  // fixture, then derive each group's table from the picks already loaded above
  // (only predicted matches contribute; unpredicted groups show empty). Real
  // results are never mixed in. The group-stage key and scope come from the
  // active competition's format; competitions with no group stage skip this.
  const activeCompetition = await getActiveCompetition();
  const groupKey = activeCompetition
    ? groupStageKey(activeCompetition.format)
    : null;
  const { data: groupFixtures } =
    activeCompetition && groupKey
      ? await supabase
          .from("matches")
          .select("id, home_team, away_team, group_code")
          .eq("competition_id", activeCompetition.id)
          .eq("stage", groupKey)
      : { data: [] };
  const predictionsByMatchId = new Map(
    (picks ?? []).map((p) => [
      p.match_id,
      { home_goals: p.home_goals, away_goals: p.away_goals },
    ]),
  );
  const simulatedGroups = simulateAllGroups(
    groupFixtures ?? [],
    predictionsByMatchId,
  );

  // Real, results-derived group tables for the side-by-side split. Read-only;
  // built from actual `final` results. `hasGroupStage` is false when no group
  // stage is active, in which case the split is hidden below.
  const realGroups = await getGroupTables();

  // One shared, read-only standing summary feeds the cards here and on the
  // signed-in landing. Never recomputes or writes competitive scoring.
  const standingSummary = await getStandingSummary(user.id);

  // Order the full pick set by match kickoff (earliest first) BEFORE paging, so
  // the pages partition one global kickoff order. The DB does not sort this for
  // us — the query's embedded match cannot order the parent predictions — so it
  // is done in memory here. Stats above and the group simulation below read the
  // same full set; only the rendered list is windowed. Page is clamped, so any
  // URL renders.
  const allPicks = sortPicksByKickoff(picks ?? []);
  const pageInfo = paginate(allPicks.length, parsePageParam(pageParam));
  const pagePicks = allPicks.slice(pageInfo.start, pageInfo.end);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
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
            {t("lede")}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <Stat label={t("statPicks")} value={picks?.length ?? 0} />
          <Stat label={t("statExact")} value={exactCount} accent="flag" />
          <Stat label={t("statPoints")} value={totalPoints} accent="pitch" />
          <Stat
            label={t("statStreak")}
            value={
              <span className="flex items-center gap-1.5">
                <FlameIcon
                  className={cn(
                    "size-5",
                    streak > 0 ? "text-orange-500" : "text-muted-foreground/50",
                  )}
                  aria-hidden
                />
                {streak}
                <span
                  className="ml-1 inline-flex items-center gap-0.5 text-xs font-medium text-sky-500"
                  title={t("freezeRemaining", { count: freeze.remaining })}
                >
                  <SnowflakeIcon className="size-3.5" aria-hidden />
                  {freeze.remaining}
                </span>
              </span>
            }
            hint={freeze.usedThisWeek ? t("freezeSaved") : t("statStreakHint")}
          />
        </dl>
      </header>

      <StandingCardsTracker />
      <StandingCards summary={standingSummary} className="mb-8" />

      {(picks?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("emptyEyebrow")}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm">{t("emptyBody")}</p>
          <Link
            href={localePath(locale, "/matches")}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:text-pitch hover:underline"
          >
            {t("browseMatches")} <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      ) : (
        <>
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {pagePicks.map((p, i) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m = (p as any).matches as {
              id: string;
              home_team: string;
              away_team: string;
              kickoff_at: string;
              status: "scheduled" | "live" | "final" | "cancelled";
              home_score: number | null;
              away_score: number | null;
            };
            const locked = isLocked(m);
            const score = scoreByMatch.get(p.match_id);
            const uiStatus =
              m.status === "live"
                ? "live"
                : m.status === "final"
                  ? "final"
                  : m.status === "cancelled"
                    ? "cancelled"
                    : locked
                      ? "locked"
                      : "scheduled";
            const exact = score?.hit_type === "exact";
            return (
              <li
                key={p.match_id}
                className={cn(
                  "grid items-center gap-3 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:gap-4",
                  i !== 0 && "border-t border-border",
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <LocalTime iso={m.kickoff_at} />
                    </span>
                    <MatchStateBadge status={uiStatus} size="sm" />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 truncate font-heading text-base font-semibold tracking-tight">
                    <TeamFlag team={m.home_team} size="sm" />
                    <span className="truncate">{m.home_team}</span>
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      vs
                    </span>
                    <TeamFlag team={m.away_team} size="sm" />
                    <span className="truncate">{m.away_team}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="text-muted-foreground">{t("rowPick")}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {p.home_goals}–{p.away_goals}
                    </span>
                    {m.status === "final" && m.home_score != null && m.away_score != null ? (
                      <>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="text-muted-foreground">{t("rowFinal")}</span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {m.home_score}–{m.away_score}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="text-muted-foreground">{t("rowFinal")}</span>
                        <span className="italic text-muted-foreground/70">
                          {t("rowPending")}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-self-end">
                  {score ? (
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]",
                        score.points > 0
                          ? exact
                            ? "bg-flag text-flag-foreground"
                            : "bg-pitch text-pitch-foreground"
                          : "border border-border bg-secondary text-muted-foreground",
                      )}
                    >
                      +{score.points} {score.points === 1 ? t("ptsSingular") : t("ptsPlural")} ·{" "}
                      {score.hit_type}
                    </span>
                  ) : null}
                  {!locked ? (
                    <Link
                      href={localePath(locale, `/matches/${m.id}`)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:text-pitch hover:underline"
                    >
                      <PencilLineIcon className="size-3.5" />
                      {t("rowEdit")}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <PaginationControls
          page={pageInfo.page}
          totalPages={pageInfo.totalPages}
          basePath={localePath(locale, "/my-picks")}
          navLabel={t("paginationLabel")}
          positionLabel={t("pagePosition", {
            current: pageInfo.page,
            total: pageInfo.totalPages,
          })}
          prevLabel={t("prevPage")}
          nextLabel={t("nextPage")}
        />
        </>
      )}

      {groupKey && realGroups.hasGroupStage ? (
        <>
          <PicksVsResultsTracker />
          <PicksVsResults
            pickGroups={simulatedGroups}
            resultGroups={realGroups.groups}
            className="mt-12"
          />
        </>
      ) : null}
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "pitch" | "flag";
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono text-xl font-semibold tabular-nums",
          accent === "pitch" && "text-pitch",
          accent === "flag" && "text-flag",
        )}
      >
        {value}
      </dd>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
