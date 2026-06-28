import { LocalTime } from "@/components/local-time";
import { TeamFlag } from "@/components/team-flag";
import type { BracketSlotMatch, ResolvedParticipant } from "@/lib/bracket-core";
import { cn } from "@/lib/utils";

// Shared by both bracket layouts (desktop columns + mobile round selector) so a
// single card definition keeps content/behavior identical. Pure render helpers
// (no client boundary) — usable from a server component and a "use client" one.

export type Labels = {
  // Localized round name per stage key.
  stage: Record<string, string>;
  provisional: string;
  thirdPlace: string;
  // Accessible label for the mobile round-selector tablist.
  selectorLabel: string;
};

export function MatchCard({
  match,
  provisionalLabel,
}: {
  match: BracketSlotMatch;
  provisionalLabel: string;
}) {
  const decided =
    match.status === "final" &&
    match.homeScore != null &&
    match.awayScore != null &&
    match.homeScore !== match.awayScore;
  const homeWon = decided && match.homeScore! > match.awayScore!;
  const awayWon = decided && match.awayScore! > match.homeScore!;
  const provisional =
    match.home.status === "provisional" || match.away.status === "provisional";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <ParticipantRow
        p={match.home}
        score={match.homeScore}
        won={homeWon}
        showScore={match.status === "final"}
      />
      <div className="h-px bg-border/60" />
      <ParticipantRow
        p={match.away}
        score={match.awayScore}
        won={awayWon}
        showScore={match.status === "final"}
      />
      <div className="border-t border-border/60 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        <LocalTime iso={match.kickoffAt} format="datetime" />
        {match.venue ? (
          <span className="mt-0.5 block truncate">{match.venue}</span>
        ) : null}
      </div>
      {provisional ? (
        <div className="border-t border-dashed border-border/60 px-2.5 py-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-600 dark:text-amber-500">
            {provisionalLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ParticipantRow({
  p,
  score,
  won,
  showScore,
}: {
  p: ResolvedParticipant;
  score: number | null;
  won: boolean;
  showScore: boolean;
}) {
  const resolved = p.team != null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 text-sm",
        won && "bg-pitch/5",
      )}
    >
      {resolved ? (
        <TeamFlag team={p.team!} size="sm" />
      ) : (
        <span
          aria-hidden
          className="inline-block h-[15px] w-5 shrink-0 rounded-[2px] bg-muted ring-1 ring-border"
        />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          resolved ? (won ? "font-semibold text-foreground" : "text-foreground") : "text-muted-foreground",
          p.status === "provisional" && "italic",
        )}
      >
        {p.label}
      </span>
      {showScore && score != null ? (
        <span className={cn("font-mono tabular-nums", won ? "font-semibold" : "text-muted-foreground")}>
          {score}
        </span>
      ) : null}
    </div>
  );
}
