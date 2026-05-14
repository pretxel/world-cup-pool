import Link from "next/link";

export const metadata = { title: "How it works — World Cup 2026 Pool" };

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Home
      </Link>
      <h1 className="mt-4 text-3xl font-bold">How it works</h1>

      <h2 className="mt-8 text-xl font-semibold">Submitting predictions</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Predict the exact final score (regulation + extra time, no penalties counted) for every
        World Cup 2026 match. Open a match&apos;s page, enter the two scores, save.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        You can edit your pick any number of times until kickoff. After kickoff, the database
        refuses any changes — no late edits, no exceptions.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Points</h2>
      <ul className="mt-2 space-y-2 text-sm">
        <li>
          <strong className="font-mono">5</strong> · Exact score.
        </li>
        <li>
          <strong className="font-mono">3</strong> · Correct winner (or correct draw) AND correct
          goal difference.
        </li>
        <li>
          <strong className="font-mono">1</strong> · Correct winner only.
        </li>
        <li>
          <strong className="font-mono">0</strong> · Wrong winner.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Tie-breakers</h2>
      <p className="mt-2 text-sm text-muted-foreground">When two players have the same total points, the higher rank goes to:</p>
      <ol className="mt-2 list-decimal pl-5 text-sm">
        <li>More exact-score hits.</li>
        <li>Then more correct-winner-with-goal-difference hits.</li>
        <li>Then the earlier &ldquo;most-recent submission&rdquo; timestamp.</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold">Daily leaderboard</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The default Leaderboard view shows points earned on matches played <em>today</em>, in your
        timezone. Use the date picker to look at previous days, or switch to &ldquo;Overall&rdquo; for the
        tournament-wide standings.
      </p>
    </main>
  );
}
