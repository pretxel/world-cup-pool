import { getTranslations, getFormatter, getLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { KickoffCountdown } from "@/components/kickoff-countdown";
import { getActiveCompetition } from "@/lib/competition";
import { TOURNAMENT_OPENING, TOURNAMENT_START_ISO } from "@/lib/tournament";
import { flagSlug } from "@/lib/team-flag";

type OpeningMatch = {
  kickoff_at: string;
  home_team: string;
  away_team: string;
  venue: string | null;
};

async function fetchOpeningMatch(
  competitionId?: string,
): Promise<OpeningMatch | null> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("matches")
      .select("kickoff_at, home_team, away_team, venue");
    if (competitionId) query = query.eq("competition_id", competitionId);
    const { data } = await query
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as OpeningMatch | null) ?? null;
  } catch {
    return null;
  }
}

function looksLikeRealFixture(m: OpeningMatch): boolean {
  // The seed has placeholders like "2nd Group A" / "Winner R32-1" for knockout
  // slots. Treat anything without a flag slug as a placeholder so the subhead
  // doesn't read like a bracket diagram.
  return flagSlug(m.home_team) !== null && flagSlug(m.away_team) !== null;
}

export async function TournamentCountdown() {
  const t = await getTranslations("home");
  const format = await getFormatter();
  const locale = await getLocale();

  const competition = await getActiveCompetition();
  const opening = await fetchOpeningMatch(competition?.id);

  const iso =
    opening?.kickoff_at ??
    competition?.tournament_start_at ??
    TOURNAMENT_START_ISO;
  const targetMs = new Date(iso).getTime();
  // Request-time decision: do we render the live pill or the countdown tiles?
  // Date.now() is intentionally impure here — every server render checks the
  // current wall clock to pick the branch.
  // eslint-disable-next-line react-hooks/purity
  const isLive = targetMs <= Date.now();

  const labels = {
    days: t("countdownDays"),
    hours: t("countdownHrs"),
    mins: t("countdownMin"),
    secs: t("countdownSec"),
  };

  const useDbFixture = opening && looksLikeRealFixture(opening);
  const home = useDbFixture
    ? opening!.home_team
    : (competition?.opening_home ?? TOURNAMENT_OPENING.home);
  const away = useDbFixture
    ? opening!.away_team
    : (competition?.opening_away ?? TOURNAMENT_OPENING.away);
  const dateLabel = format.dateTime(new Date(iso), {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section
      aria-label={t("countdownEyebrow")}
      className="relative border-y border-border/70 bg-muted/30"
    >
      <div className="bg-grain pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="bg-pitch-stripes absolute inset-0 opacity-[0.05] dark:opacity-[0.08]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-10 text-center sm:py-12">
        {isLive ? (
          <>
            <span className="live-pulse inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-destructive">
              <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
              {t("countdownLive")}
            </span>
            <p className="max-w-xl text-sm text-muted-foreground">
              {t("countdownLiveSubhead")}
            </p>
          </>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {t("countdownEyebrow")}
            </p>
            <KickoffCountdown
              kickoffAt={iso}
              variant="stacked"
              labels={labels}
              className="gap-3 [&>div]:min-w-[4.5rem] [&>div]:px-4 [&>div]:py-3 [&_span]:first:text-3xl sm:gap-4 sm:[&>div]:min-w-[5.5rem] sm:[&_span]:first:text-4xl"
              lockedNode={
                <span className="live-pulse inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-destructive">
                  <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
                  {t("countdownLive")}
                </span>
              }
            />
            <p
              className="max-w-xl font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
              suppressHydrationWarning
            >
              {t("countdownSubhead", { home, away, date: dateLabel })}
            </p>
            <span className="sr-only">{locale}</span>
          </>
        )}
      </div>
    </section>
  );
}
