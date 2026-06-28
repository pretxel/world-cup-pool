import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Minimal row shape shared by the global board (v_leaderboard_overall /
// leaderboard_for_day) and the per-group board (leaderboard_for_group).
export type BoardRow = {
  user_id: string;
  display_name: string | null;
  total_points: number | null;
  exact_hits: number | null;
  winner_gd_hits: number | null;
  winner_hits: number | null;
  rank: number | null;
};

export type LeaderboardLabels = {
  rank: string;
  player: string;
  points: string;
  exact: string;
  winnerGd: string;
  wins: string;
  you: string;
  noName: string;
  // Optional plain-language expansions for the abbreviated stat columns,
  // surfaced via <abbr title> so first-time viewers can decode EXACT / W+GD /
  // WINS without leaving the page.
  exactHint?: string;
  winnerGdHint?: string;
  winsHint?: string;
};

// Wraps an abbreviated column header in <abbr> when a hint is provided, giving
// a native tooltip + assistive-tech expansion; renders plain text otherwise.
function ColHint({ label, hint }: { label: string; hint?: string }) {
  if (!hint) return <>{label}</>;
  return (
    <abbr title={hint} className="cursor-help no-underline [text-decoration:none]">
      {label}
    </abbr>
  );
}

export function RankBadge({ rank }: { rank: number | null }) {
  const r = rank ?? 0;
  let tone =
    "bg-secondary text-muted-foreground ring-1 ring-inset ring-border";
  let label = "—";
  if (r > 0) {
    label = String(r);
    if (r === 1) tone = "bg-flag text-flag-foreground ring-1 ring-inset ring-flag/40";
    else if (r === 2) tone = "bg-foreground/85 text-background ring-1 ring-inset ring-foreground/30";
    else if (r === 3) tone = "bg-pitch/90 text-pitch-foreground ring-1 ring-inset ring-pitch/30";
  }
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-[2rem] items-center justify-center rounded-md px-1.5 font-mono text-sm font-semibold tabular-nums",
        tone,
      )}
    >
      {label}
    </span>
  );
}

// Presentational ranking table reused by the global leaderboard and the
// per-group mini board. Translation strings are passed in as `labels` so the
// component stays namespace-agnostic.
export function LeaderboardTable({
  rows,
  currentUserId,
  labels,
}: {
  rows: BoardRow[];
  currentUserId?: string | null;
  labels: LeaderboardLabels;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-14 pl-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {labels.rank}
            </TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {labels.player}
            </TableHead>
            <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {labels.points}
            </TableHead>
            <TableHead className="hidden text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:table-cell">
              <ColHint label={labels.exact} hint={labels.exactHint} />
            </TableHead>
            <TableHead className="hidden text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:table-cell">
              <ColHint label={labels.winnerGd} hint={labels.winnerGdHint} />
            </TableHead>
            <TableHead className="hidden pr-4 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:table-cell">
              <ColHint label={labels.wins} hint={labels.winsHint} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isMe = currentUserId === r.user_id;
            return (
              <TableRow
                key={r.user_id}
                className={cn(
                  "transition-colors",
                  isMe &&
                    "relative bg-flag/15 hover:bg-flag/20 dark:bg-flag/10",
                )}
              >
                <TableCell className="pl-4">
                  <RankBadge rank={r.rank} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate font-medium",
                        isMe && "text-foreground",
                      )}
                    >
                      {r.display_name ?? (
                        <span className="text-muted-foreground italic">
                          {labels.noName}
                        </span>
                      )}
                    </span>
                    {isMe ? (
                      <span className="rounded-md bg-flag px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-flag-foreground">
                        {labels.you}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-base font-semibold tabular-nums">
                    {r.total_points}
                  </span>
                </TableCell>
                <TableCell className="hidden text-right font-mono tabular-nums text-muted-foreground sm:table-cell">
                  {r.exact_hits}
                </TableCell>
                <TableCell className="hidden text-right font-mono tabular-nums text-muted-foreground sm:table-cell">
                  {r.winner_gd_hits}
                </TableCell>
                <TableCell className="hidden pr-4 text-right font-mono tabular-nums text-muted-foreground sm:table-cell">
                  {r.winner_hits ?? 0}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
