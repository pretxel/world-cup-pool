import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeaderboardRow } from "@/lib/db";
import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "World Cup 2026 Pool standings. The single overall ranking refreshes the moment an admin enters a final score.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "Leaderboard · WC26 Pool",
    description:
      "Overall standings for the World Cup 2026 prediction pool. Refreshes after every result.",
    url: "/leaderboard",
    type: "website",
  },
};

export default async function LeaderboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("v_leaderboard_overall")
    .select("*")
    .order("rank", { ascending: true });

  const loadError = error?.message ?? null;
  const rows: LeaderboardRow[] = (data ?? []) as LeaderboardRow[];

  const myRow = user ? rows.find((r) => r.user_id === user.id) : undefined;
  const players = rows.length;
  const leader = rows[0];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Standings
          </p>
          <h1
            className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
            style={{ fontStretch: "condensed" }}
          >
            Leaderboard
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            One global ranking across the whole tournament. Standings refresh
            the moment an admin enters a final score.
          </p>
        </div>

        {leader ? (
          <div className="rounded-xl border border-pitch/30 bg-pitch text-pitch-foreground px-4 py-3 shadow-sm">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-pitch-foreground/70">
              Overall leader
            </div>
            <div className="mt-1 font-heading text-lg font-semibold tracking-tight">
              {leader.display_name ?? "—"}
            </div>
            <div className="mt-0.5 font-mono text-xs uppercase tracking-[0.18em] text-pitch-foreground/80">
              {leader.total_points} pts · {players}{" "}
              {players === 1 ? "player" : "players"}
            </div>
          </div>
        ) : null}
      </header>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            No results yet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            No completed matches yet. Check back once the first results are in.
          </p>
          <Link
            href="/matches"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:text-pitch hover:underline"
          >
            Browse matches <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-14 pl-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Rank
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Player
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Pts
                </TableHead>
                <TableHead className="hidden text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:table-cell">
                  Exact
                </TableHead>
                <TableHead className="hidden pr-4 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:table-cell">
                  W+GD
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const isMe = user?.id === r.user_id;
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
                              (no name)
                            </span>
                          )}
                        </span>
                        {isMe ? (
                          <span className="rounded-md bg-flag px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-flag-foreground">
                            You
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
                    <TableCell className="hidden pr-4 text-right font-mono tabular-nums text-muted-foreground sm:table-cell">
                      {r.winner_gd_hits}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {user && !myRow && rows.length > 0 ? (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">You&apos;re not yet on the board.</p>
            <p className="mt-1 text-muted-foreground">
              Submit predictions to start banking points.
            </p>
          </div>
          <Link
            href="/matches"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:text-pitch hover:underline"
          >
            Browse matches <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </main>
  );
}

function RankBadge({ rank }: { rank: number | null }) {
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
