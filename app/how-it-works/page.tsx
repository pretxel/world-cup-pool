import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Learn the World Cup 2026 Pool scoring rules: exact scores earn five points, correct winner with goal difference earns three, correct winner earns one.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How it works · WC26 Pool",
    description:
      "Scoring rules, tie-breakers, and how the daily leaderboard works.",
    url: "/how-it-works",
    type: "website",
  },
};

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Home
      </Link>

      <header className="mt-5 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Rulebook
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ fontStretch: "condensed" }}
        >
          How it works
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Three rules, one pool, picks that lock the second the ball rolls.
        </p>
      </header>

      <Section index="01" title="Submitting predictions">
        <p>
          Predict the exact final score (regulation + extra time, no penalties
          counted) for every World Cup 2026 match. Open a match&apos;s page, enter
          the two scores, save.
        </p>
        <p className="mt-3">
          You can edit your pick any number of times until kickoff. After
          kickoff, the database itself refuses any change — no late edits, no
          exceptions.
        </p>
      </Section>

      <Section index="02" title="Points">
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            { pts: 5, label: "Exact score." },
            { pts: 3, label: "Correct winner (or draw) AND correct goal difference." },
            { pts: 1, label: "Correct winner only." },
            { pts: 0, label: "Wrong winner." },
          ].map((row) => (
            <li
              key={row.pts}
              className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
            >
              <span className="font-mono text-3xl font-semibold tabular-nums text-pitch">
                {row.pts}
              </span>
              <span className="text-sm">{row.label}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section index="03" title="Tie-breakers">
        <p>When two players share a point total, the higher rank goes to:</p>
        <ol className="mt-3 grid gap-2">
          {[
            "More exact-score hits.",
            "Then more correct-winner-with-goal-difference hits.",
            "Then the earlier most-recent submission timestamp.",
          ].map((line, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-pitch text-pitch-foreground font-mono text-[11px] font-bold tabular-nums">
                {i + 1}
              </span>
              <span className="text-sm">{line}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section index="04" title="Daily leaderboard">
        <p>
          The default Leaderboard view shows points earned on matches played{" "}
          <em>today</em>, in your timezone. Use the date picker to look at
          previous days, or switch to &ldquo;Overall&rdquo; for the
          tournament-wide standings.
        </p>
      </Section>
    </main>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {index}
        </span>
        <span
          className="font-heading text-2xl font-semibold tracking-tight"
          style={{ fontStretch: "condensed" }}
        >
          {title}
        </span>
      </h2>
      <div className="mt-4 text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&>p]:text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
