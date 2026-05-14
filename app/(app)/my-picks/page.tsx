import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { isLocked, statusLabel } from "@/lib/match-utils";

export const metadata = { title: "My picks — World Cup 2026 Pool" };

export default async function MyPicksPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already guards, but pages render in parallel with layouts under
  // React Server Components — re-check here so we never deref a null user.
  if (!user) redirect("/sign-in?next=/my-picks");

  const { data: picks, error } = await supabase
    .from("predictions")
    .select("match_id, home_goals, away_goals, submitted_at, matches!inner(*)")
    .eq("user_id", user.id)
    .order("kickoff_at", { foreignTable: "matches", ascending: true });

  if (error) {
    return <p className="p-6 text-sm text-destructive">Failed to load picks: {error.message}</p>;
  }

  const { data: scores } = await supabase
    .from("scores")
    .select("match_id, points, hit_type")
    .eq("user_id", user.id);
  const scoreByMatch = new Map(scores?.map((s) => [s.match_id, s]) ?? []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">My picks</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every match you&apos;ve submitted a prediction for.
          </p>
        </div>
        <Link href="/matches" className="text-sm text-muted-foreground hover:underline">
          Browse matches →
        </Link>
      </header>

      {(picks?.length ?? 0) === 0 ? (
        <p className="rounded-md border bg-muted/40 p-6 text-sm">
          You haven&apos;t submitted any predictions yet.{" "}
          <Link href="/matches" className="underline">
            Pick some matches.
          </Link>
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {picks!.map((p) => {
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
            return (
              <li key={p.match_id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">
                    <LocalTime iso={m.kickoff_at} />
                  </div>
                  <div className="mt-1 font-medium">
                    {m.home_team} <span className="text-muted-foreground">vs</span> {m.away_team}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Your pick:{" "}
                    <span className="font-mono">
                      {p.home_goals}–{p.away_goals}
                    </span>
                    {m.status === "final" && m.home_score != null && m.away_score != null ? (
                      <>
                        {" "}
                        · Final:{" "}
                        <span className="font-mono">
                          {m.home_score}–{m.away_score}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  {score ? (
                    <Badge variant={score.points > 0 ? "default" : "outline"}>
                      {score.points} pt{score.points === 1 ? "" : "s"} · {score.hit_type}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{statusLabel(m.status)}</Badge>
                  )}
                  {!locked ? (
                    <div className="mt-2">
                      <Link
                        className="text-xs text-primary underline"
                        href={`/matches/${m.id}`}
                      >
                        Edit
                      </Link>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
