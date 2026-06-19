import { TeamFlag } from "@/components/team-flag";
import type {
  BracketRound,
  BracketSlotMatch,
  ResolvedParticipant,
} from "@/lib/bracket-core";
import { cn } from "@/lib/utils";

type Labels = {
  // Localized round name per stage key.
  stage: Record<string, string>;
  provisional: string;
  thirdPlace: string;
};

// Data-driven knockout bracket. Main rounds (R32→final) render as columns that
// scroll horizontally on small screens; `justify-around` on equal-height
// columns centers each later-round match between its two feeders. The
// third-place play-off renders as a separate block.
export function BracketView({
  rounds,
  labels,
  className,
}: {
  rounds: BracketRound[];
  labels: Labels;
  className?: string;
}) {
  const main = rounds.filter((r) => r.stage !== "third");
  const third = rounds.find((r) => r.stage === "third");

  return (
    <div className={className}>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3 sm:gap-4">
          {main.map((round) => (
            <div
              key={round.stage}
              className="flex w-52 flex-col justify-around gap-3 sm:w-56"
            >
              <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {labels.stage[round.stage] ?? round.stage}
              </h2>
              {round.matches.map((m) => (
                <MatchCard key={m.id} match={m} provisionalLabel={labels.provisional} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {third ? (
        <div className="mt-8 max-w-sm">
          <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {labels.thirdPlace}
          </h2>
          {third.matches.map((m) => (
            <MatchCard key={m.id} match={m} provisionalLabel={labels.provisional} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MatchCard({
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
