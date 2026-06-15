"use client";

import { useLivePolling } from "@/hooks/use-live-polling";
import {
  displayScore,
  type LiveFeedPayload,
  type MatchEvent,
  type MatchEventType,
} from "@/lib/matches/match-events";
import { TeamFlag } from "@/components/team-flag";

const POLL_MS = 15_000;

export type LiveFeedLabels = {
  heading: string;
  live: string;
  // sr-only label for the single polite live region
  updatesLabel: string;
  empty: string;
  eventTypes: Record<MatchEventType, string>;
};

// Decorative glyph per event type. Conveyed meaning lives in the localized
// text label beside it; these are aria-hidden.
const EVENT_GLYPH: Record<MatchEventType, string> = {
  goal: "⚽",
  own_goal: "⚽",
  penalty_goal: "⚽",
  penalty_missed: "✖",
  yellow: "🟨",
  red: "🟥",
  yellow_red: "🟨",
  substitution: "🔁",
  period_start: "▶",
  period_end: "⏸",
  var: "📺",
  other: "•",
};

function minuteLabel(event: MatchEvent): string {
  if (event.minute == null) return "";
  return event.extraMinute
    ? `${event.minute}+${event.extraMinute}'`
    : `${event.minute}'`;
}

function latestMinute(events: MatchEvent[]): string {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].minute != null) return minuteLabel(events[i]);
  }
  return "";
}

export function LiveEventsFeed({
  matchId,
  homeTeam,
  awayTeam,
  initialData,
  labels,
}: {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  initialData: LiveFeedPayload;
  labels: LiveFeedLabels;
}) {
  const data = useLivePolling<LiveFeedPayload>({
    initialData,
    url: `/api/matches/${matchId}/live`,
    intervalMs: POLL_MS,
    // Stop at full time / cancellation, or when there is simply nothing live to
    // watch yet (a not-yet-kicked-off match with no events).
    stopWhen: (p) =>
      p.status === "final" ||
      p.status === "cancelled" ||
      (!p.isLive && p.events.length === 0),
  });

  // Nothing to surface until the match is live or has events.
  if (!data.isLive && data.events.length === 0) return null;

  const score = displayScore(data);
  const minute = latestMinute(data.events);
  const ordered = [...data.events].sort((a, b) => b.sequence - a.sequence);

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <h2
          className="font-heading text-xl font-semibold tracking-tight"
          style={{ fontStretch: "condensed" }}
        >
          {labels.heading}
        </h2>
        {data.isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-destructive">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-destructive motion-safe:animate-pulse"
            />
            {labels.live}
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Live scoreline — derived from goal events, updates in place. */}
        <div className="flex items-center justify-center gap-3 border-b border-border px-4 py-4 sm:gap-5">
          <span className="flex min-w-0 items-center gap-2">
            <TeamFlag team={homeTeam} size="sm" />
            <span className="truncate font-heading text-sm font-semibold sm:text-base">
              {homeTeam}
            </span>
          </span>
          <span className="shrink-0 font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
            {score.home ?? "–"}
            <span className="px-1 text-muted-foreground">–</span>
            {score.away ?? "–"}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-heading text-sm font-semibold sm:text-base">
              {awayTeam}
            </span>
            <TeamFlag team={awayTeam} size="sm" />
          </span>
          {minute ? (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {minute}
            </span>
          ) : null}
        </div>

        {/* Single polite region: AT announces the timeline as one unit. */}
        <ul
          aria-live="polite"
          aria-label={labels.updatesLabel}
          className="divide-y divide-border"
        >
          {ordered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              {labels.empty}
            </li>
          ) : (
            ordered.map((event) => {
              const min = minuteLabel(event);
              return (
                // Keyed by event id: only genuinely new events mount (and so
                // animate in); reused rows keep their DOM node and do not
                // re-animate. Reduced motion drops the animation via motion-safe.
                <li
                  key={event.id}
                  className="flex items-center gap-3 px-4 py-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500"
                >
                  <span className="w-9 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {min}
                  </span>
                  <span aria-hidden className="shrink-0 text-base leading-none">
                    {EVENT_GLYPH[event.type]}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">
                      {labels.eventTypes[event.type]}
                    </span>
                    {event.player ? (
                      <span className="text-muted-foreground">
                        {" — "}
                        {event.player}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </section>
  );
}
