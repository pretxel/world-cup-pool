"use client";

import * as React from "react";
import Link from "next/link";
import { MatchStateBadge } from "@/components/match-state-badge";
import { TeamFlag } from "@/components/team-flag";
import { KickoffCountdown } from "@/components/kickoff-countdown";
import { localePath, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { LiveFixture, LiveMatchesPayload } from "@/lib/matches/live";

const POLL_MS = 30_000;
// Cap how many live rows render inline; the rest live on /matches.
const MAX_VISIBLE = 4;

export type LiveMatchLabels = {
  onNow: string;
  nextUp: string;
  vs: string;
  viewAll: string;
  kickoffSoon: string;
  countdown: { days: string; hours: string; mins: string; secs: string };
};

export function LiveMatchList({
  initialData,
  locale,
  labels,
}: {
  initialData: LiveMatchesPayload;
  locale: Locale;
  labels: LiveMatchLabels;
}) {
  const [data, setData] = React.useState<LiveMatchesPayload>(initialData);
  // Latest payload for the scheduler, which lives in a once-created effect and
  // would otherwise close over stale state.
  const latest = React.useRef<LiveMatchesPayload>(initialData);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    // Stop polling once nothing is live and the next kickoff is not imminent
    // (more than one interval away). Re-armed when the tab regains focus.
    const idle = (p: LiveMatchesPayload): boolean => {
      if (p.live.length > 0) return false;
      const nextMs = p.nextUp
        ? new Date(p.nextUp.kickoff_at).getTime() - Date.now()
        : Infinity;
      return nextMs > POLL_MS;
    };

    const schedule = (p: LiveMatchesPayload) => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (cancelled) return;
      if (document.visibilityState === "hidden") return;
      if (idle(p)) return;
      timer = setTimeout(fetchOnce, POLL_MS);
    };

    const fetchOnce = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch("/api/live-matches", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          schedule(latest.current);
          return;
        }
        const payload = (await res.json()) as LiveMatchesPayload;
        if (cancelled) return;
        latest.current = payload;
        setData(payload);
        schedule(payload);
      } catch {
        // Aborts land here too; only reschedule when still mounted.
        if (!cancelled) schedule(latest.current);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchOnce();
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    schedule(initialData);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Run once; the scheduler reads fresh data via `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = data.live.slice(0, MAX_VISIBLE);
  const overflow = data.live.length - visible.length;

  if (data.live.length === 0 && !data.nextUp) return null;

  return (
    <div className="w-full max-w-2xl">
      {data.live.length > 0 ? (
        <>
          <p className="mb-3 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {labels.onNow}
          </p>
          <ul className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm">
            {visible.map((f, i) => (
              <li key={f.id} className={cn(i !== 0 && "border-t border-border")}>
                <LiveRow fixture={f} locale={locale} vs={labels.vs} />
              </li>
            ))}
          </ul>
          {overflow > 0 ? (
            <div className="mt-3 text-center">
              <Link
                href={localePath(locale, "/matches")}
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {labels.viewAll}
              </Link>
            </div>
          ) : null}
        </>
      ) : data.nextUp ? (
        <NextUpCard
          fixture={data.nextUp}
          locale={locale}
          labels={labels}
        />
      ) : null}
    </div>
  );
}

function LiveRow({
  fixture,
  locale,
  vs,
}: {
  fixture: LiveFixture;
  locale: Locale;
  vs: string;
}) {
  const home = fixture.home_score ?? 0;
  const away = fixture.away_score ?? 0;

  return (
    <Link
      href={localePath(locale, `/matches/${fixture.id}`)}
      className="group/live flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4"
    >
      <MatchStateBadge status="live" size="sm" className="shrink-0" />

      <div className="min-w-0 flex-1 font-heading text-sm font-semibold tracking-tight text-foreground sm:text-base">
        <span className="flex min-w-0 items-center gap-2">
          <TeamFlag team={fixture.home_team} size="sm" />
          <span className="truncate">{fixture.home_team}</span>
          <span className="px-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {vs}
          </span>
          <TeamFlag team={fixture.away_team} size="sm" />
          <span className="truncate">{fixture.away_team}</span>
        </span>
      </div>

      <span
        aria-live="polite"
        className="shrink-0 font-mono text-lg font-semibold tabular-nums text-foreground"
      >
        {home}<span className="text-muted-foreground">–</span>{away}
      </span>
    </Link>
  );
}

function NextUpCard({
  fixture,
  locale,
  labels,
}: {
  fixture: LiveFixture;
  locale: Locale;
  labels: LiveMatchLabels;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {labels.nextUp}
      </p>
      <Link
        href={localePath(locale, `/matches/${fixture.id}`)}
        className="mt-2 inline-flex items-center justify-center gap-2 font-heading text-base font-semibold tracking-tight text-foreground underline-offset-4 hover:underline sm:text-lg"
      >
        <TeamFlag team={fixture.home_team} size="sm" />
        <span>{fixture.home_team}</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {labels.vs}
        </span>
        <TeamFlag team={fixture.away_team} size="sm" />
        <span>{fixture.away_team}</span>
      </Link>
      <div className="mt-3 flex justify-center">
        <KickoffCountdown
          kickoffAt={fixture.kickoff_at}
          labels={labels.countdown}
          lockedLabel={labels.kickoffSoon}
        />
      </div>
    </div>
  );
}
