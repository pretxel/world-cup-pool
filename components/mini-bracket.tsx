import { TeamFlag } from "@/components/team-flag";
import { cn } from "@/lib/utils";

type Match = { home: string; away: string; score?: [number, number] };

const QF: Match[] = [
  { home: "Argentina", away: "Mexico", score: [2, 1] },
  { home: "France", away: "Brazil", score: [1, 2] },
  { home: "Germany", away: "Spain", score: [0, 1] },
  { home: "Portugal", away: "Netherlands", score: [3, 2] },
];

const SF: Match[] = [
  { home: "Argentina", away: "Brazil" },
  { home: "Spain", away: "Portugal" },
];

const FINAL: Match[] = [{ home: "Argentina", away: "Spain" }];

export function MiniBracket({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 sm:gap-3",
        className,
      )}
      aria-hidden="true"
    >
      <Column matches={QF} label="QF" align="left" />
      <Connector side="left" rows={4} />
      <Column matches={SF} label="SF" align="center" />
      <Connector side="right" rows={2} />
      <Column matches={FINAL} label="Final" align="right" trophy />
    </div>
  );
}

function Column({
  matches,
  label,
  align,
  trophy,
}: {
  matches: Match[];
  label: string;
  align: "left" | "center" | "right";
  trophy?: boolean;
}) {
  return (
    <div className="flex flex-col justify-around gap-2">
      <div
        className={cn(
          "font-mono text-[9px] uppercase tracking-[0.22em] text-pitch-foreground/60",
          align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        )}
      >
        {label}
      </div>
      {matches.map((m, i) => (
        <MatchPill key={i} match={m} winner={trophy && i === 0 ? "home" : undefined} />
      ))}
    </div>
  );
}

function MatchPill({
  match,
  winner,
}: {
  match: Match;
  winner?: "home" | "away";
}) {
  return (
    <div className="rounded-md bg-pitch-foreground/8 px-2 py-1.5 ring-1 ring-pitch-foreground/12 backdrop-blur-sm">
      <Row
        team={match.home}
        score={match.score?.[0]}
        winner={winner === "home"}
      />
      <Row
        team={match.away}
        score={match.score?.[1]}
        winner={winner === "away"}
      />
    </div>
  );
}

function Row({
  team,
  score,
  winner,
}: {
  team: string;
  score?: number;
  winner?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-[10px] leading-tight",
        winner ? "font-semibold text-flag" : "text-pitch-foreground/85",
      )}
    >
      <TeamFlag team={team} size="sm" className="h-2.5 w-3.5 rounded-[1px]" />
      <span className="min-w-0 flex-1 truncate font-mono">{team}</span>
      {typeof score === "number" ? (
        <span className="font-mono tabular-nums">{score}</span>
      ) : (
        <span className="font-mono text-pitch-foreground/40">—</span>
      )}
    </div>
  );
}

function Connector({ side, rows }: { side: "left" | "right"; rows: number }) {
  return (
    <svg
      viewBox={`0 0 24 ${rows * 24}`}
      preserveAspectRatio="none"
      className="h-full w-3 self-stretch text-pitch-foreground/30"
      aria-hidden="true"
    >
      {Array.from({ length: rows / 2 }).map((_, i) => {
        const yTop = i * 48 + 12;
        const yBot = yTop + 24;
        return (
          <path
            key={i}
            d={`M${side === "left" ? 0 : 24} ${yTop} H 12 V ${yBot} H ${side === "left" ? 0 : 24}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        );
      })}
    </svg>
  );
}
