import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { statusLabel, stageLabel, utcDateKey } from "@/lib/match-utils";

export const metadata = { title: "Matches — World Cup 2026 Pool" };

export default async function MatchesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: matches, error } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });

  if (error) {
    return <p className="p-6 text-sm text-destructive">Failed to load matches: {error.message}</p>;
  }

  const byDay = new Map<string, typeof matches>();
  for (const m of matches ?? []) {
    const key = utcDateKey(m.kickoff_at);
    const arr = byDay.get(key) ?? [];
    arr.push(m);
    byDay.set(key, arr);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Matches</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          All {matches?.length ?? 0} matches. Predictions lock at kickoff.
        </p>
      </header>

      <div className="space-y-8">
        {[...byDay.entries()].map(([day, dayMatches]) => (
          <section key={day}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              <LocalTime iso={`${day}T00:00:00Z`} format="date" />
            </h2>
            <ul className="divide-y rounded-lg border">
              {dayMatches!.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/matches/${m.id}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {stageLabel(m.stage)}
                          {m.group_code ? ` · ${m.group_code}` : ""}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          <LocalTime iso={m.kickoff_at} format="time" />
                        </span>
                      </div>
                      <div className="mt-1 truncate font-medium">
                        {m.home_team} <span className="text-muted-foreground">vs</span> {m.away_team}
                      </div>
                      {m.venue ? (
                        <div className="text-xs text-muted-foreground">{m.venue}</div>
                      ) : null}
                    </div>
                    <div className="text-right text-sm">
                      {m.status === "final" && m.home_score != null && m.away_score != null ? (
                        <span className="font-mono text-lg">
                          {m.home_score}–{m.away_score}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{statusLabel(m.status)}</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {(matches?.length ?? 0) === 0 ? (
          <p className="rounded-md border bg-muted/40 p-6 text-sm">
            No matches loaded yet. An admin needs to seed the fixture list.
          </p>
        ) : null}
      </div>
    </main>
  );
}
