import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isLocked, stageLabel, statusLabel } from "@/lib/match-utils";
import { PredictionForm } from "./prediction-form";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: match, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (error || !match) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myPrediction: { home_goals: number; away_goals: number } | null = null;
  if (user) {
    const { data } = await supabase
      .from("predictions")
      .select("home_goals, away_goals")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .maybeSingle();
    myPrediction = data;
  }

  const locked = isLocked(match);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/matches"
        className="mb-6 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← All matches
      </Link>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="uppercase">
          {stageLabel(match.stage)}
          {match.group_code ? ` · ${match.group_code}` : ""}
        </Badge>
        <Badge variant={match.status === "final" ? "default" : "secondary"}>
          {statusLabel(match.status)}
        </Badge>
      </div>

      <h1 className="mt-4 text-3xl font-bold">
        {match.home_team} <span className="text-muted-foreground">vs</span> {match.away_team}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kickoff: <LocalTime iso={match.kickoff_at} />
        {match.venue ? ` · ${match.venue}` : ""}
      </p>

      {match.status === "final" && match.home_score != null && match.away_score != null ? (
        <div className="mt-6 rounded-lg border bg-muted/40 p-6 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Final score</div>
          <div className="mt-2 font-mono text-4xl font-semibold">
            {match.home_score} – {match.away_score}
          </div>
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Your prediction</h2>
        {!user ? (
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <p className="mb-3">Sign in to submit a prediction for this match.</p>
            <Link
              href={`/sign-in?next=/matches/${match.id}`}
              className={buttonVariants()}
            >
              Sign in
            </Link>
          </div>
        ) : locked ? (
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            {myPrediction ? (
              <>
                Your pick was{" "}
                <strong>
                  {myPrediction.home_goals}–{myPrediction.away_goals}
                </strong>
                . Predictions are locked at kickoff.
              </>
            ) : (
              "Predictions are locked — kickoff has passed and you didn't submit one for this match."
            )}
          </div>
        ) : (
          <PredictionForm
            matchId={match.id}
            homeTeam={match.home_team}
            awayTeam={match.away_team}
            kickoffAt={match.kickoff_at}
            initial={myPrediction}
          />
        )}
      </section>
    </main>
  );
}
