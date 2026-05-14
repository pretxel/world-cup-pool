import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <section className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          FIFA World Cup 2026 · USA · Canada · Mexico
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
          Predict every match. Climb the daily leaderboard.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Sign in, submit an exact-score pick for each fixture before kickoff, and watch your
          ranking shift after every result. One global pool — no setup, no fees.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
            Sign in to play
          </Link>
          <Link
            href="/matches"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Browse matches
          </Link>
        </div>
      </section>

      <section id="scoring" className="mt-20 rounded-xl border bg-muted/30 p-6 sm:p-8">
        <h2 className="text-xl font-semibold">How scoring works</h2>
        <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <li className="rounded-md border bg-background p-4">
            <div className="font-mono text-2xl font-bold">5 pts</div>
            <div className="mt-1 font-medium">Exact score</div>
            <div className="text-xs text-muted-foreground">You called both teams&apos; goal counts.</div>
          </li>
          <li className="rounded-md border bg-background p-4">
            <div className="font-mono text-2xl font-bold">3 pts</div>
            <div className="mt-1 font-medium">Correct winner + goal difference</div>
            <div className="text-xs text-muted-foreground">e.g. you picked 2-1, actual is 3-2.</div>
          </li>
          <li className="rounded-md border bg-background p-4">
            <div className="font-mono text-2xl font-bold">1 pt</div>
            <div className="mt-1 font-medium">Correct winner only</div>
            <div className="text-xs text-muted-foreground">Right team won, but goal diff was off.</div>
          </li>
          <li className="rounded-md border bg-background p-4">
            <div className="font-mono text-2xl font-bold">0</div>
            <div className="mt-1 font-medium">Miss</div>
            <div className="text-xs text-muted-foreground">Wrong winner.</div>
          </li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Picks lock at kickoff — the database itself rejects late writes. See{" "}
          <Link href="/how-it-works" className="underline">
            how it works
          </Link>{" "}
          for tie-breaker details.
        </p>
      </section>
    </main>
  );
}
