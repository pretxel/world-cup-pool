import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRightIcon, TargetIcon, TrophyIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const scoringTiers: Array<{
  pts: number;
  title: string;
  detail: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: "pitch" | "flag" | "muted" | "ghost";
}> = [
  {
    pts: 5,
    title: "Exact score",
    detail: "Both teams’ goal counts called perfectly.",
    Icon: TargetIcon,
    accent: "pitch",
  },
  {
    pts: 3,
    title: "Winner + goal difference",
    detail: "You picked 2–1, the actual is 3–2.",
    Icon: ZapIcon,
    accent: "flag",
  },
  {
    pts: 1,
    title: "Correct winner",
    detail: "Right team won, but the gap was off.",
    Icon: TrophyIcon,
    accent: "muted",
  },
  {
    pts: 0,
    title: "Miss",
    detail: "Wrong winner. The bracket marches on.",
    Icon: ArrowRightIcon,
    accent: "ghost",
  },
];

export default function HomePage() {
  return (
    <main>
      <Hero />
      <ScoringSection />
      <Cadence />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/70">
      {/* Pitch stripes painted into the corner — broadcast field motif */}
      <div
        aria-hidden
        className="bg-pitch-stripes absolute -right-32 -top-24 h-[42rem] w-[42rem] -rotate-12 opacity-[0.08] dark:opacity-[0.18]"
        style={{
          maskImage:
            "radial-gradient(closest-side at 50% 50%, black 35%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(closest-side at 50% 50%, black 35%, transparent 75%)",
        }}
      />
      {/* Subtle grain overlay */}
      <div className="bg-grain pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 lg:grid-cols-[1.6fr_1fr] lg:items-end">
        <div className="rise" style={{ animationDelay: "0ms" }}>
          {/* Tournament eyebrow ticker */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
            <span aria-hidden className="size-1.5 rounded-full bg-flag" />
            FIFA World Cup 2026
            <span className="text-muted-foreground/40">·</span>
            USA · Canada · Mexico
          </div>

          <h1
            className="mt-6 font-heading text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-[5rem]"
            style={{ fontStretch: "condensed" }}
          >
            <span className="block">Call the score.</span>
            <span className="block text-pitch">Climb the table.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            One global pool. Submit an exact-score pick for every fixture before
            kickoff and your ranking shifts the moment the final whistle blows.
            No setup, no fees, no excuses.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-in"
              className={buttonVariants({
                size: "lg",
                className:
                  "h-11 gap-2 px-5 text-sm font-semibold uppercase tracking-[0.16em]",
              })}
            >
              Sign in to play
              <ArrowRightIcon />
            </Link>
            <Link
              href="/matches"
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className: "h-11 px-5 text-sm font-medium",
              })}
            >
              Browse matches
            </Link>
            <Link
              href="#scoring"
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              How scoring works
            </Link>
          </div>
        </div>

        {/* Scoreboard panel — broadcast tile */}
        <div
          className="rise relative overflow-hidden rounded-2xl ring-1 ring-border bg-card shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]"
          style={{ animationDelay: "120ms" }}
        >
          <div className="bg-scoreboard relative px-5 py-4 text-pitch-foreground">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-pitch-foreground/70">
              <span>Matchday — Sample</span>
              <span className="live-pulse">Live</span>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-pitch-foreground/70">
                  Home
                </div>
                <div className="font-heading text-lg font-semibold leading-tight">
                  Mexico
                </div>
              </div>
              <div className="font-mono text-3xl font-semibold tabular-nums text-pitch-foreground">
                2 – 1
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-pitch-foreground/70">
                  Away
                </div>
                <div className="font-heading text-lg font-semibold leading-tight">
                  Canada
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border bg-card text-center">
            <Stat label="Your pick" value="2 – 1" mono accent="pitch" />
            <Stat label="Points" value="+5" mono accent="flag" />
            <Stat label="Daily rank" value="↑12" mono />
          </div>
          <div className="border-t border-border bg-muted/40 px-5 py-3 text-[11px] text-muted-foreground">
            Demo card · live data appears once matches start.
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "pitch" | "flag";
}) {
  return (
    <div className="px-3 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold leading-none",
          mono && "font-mono tabular-nums",
          accent === "pitch" && "text-pitch",
          accent === "flag" && "text-flag",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ScoringSection() {
  return (
    <section
      id="scoring"
      className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            01 · Scoring
          </p>
          <h2
            className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ fontStretch: "condensed" }}
          >
            Four tiers. One pool. No deadlines after kickoff.
          </h2>
        </div>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground sm:text-right">
          Picks lock at kickoff — the database itself rejects late writes.
        </p>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {scoringTiers.map((tier, i) => {
          const accentRing =
            tier.accent === "pitch"
              ? "ring-pitch/40"
              : tier.accent === "flag"
                ? "ring-flag/50"
                : "ring-border";
          const accentBg =
            tier.accent === "pitch"
              ? "bg-pitch text-pitch-foreground"
              : tier.accent === "flag"
                ? "bg-flag text-flag-foreground"
                : tier.accent === "muted"
                  ? "bg-muted text-muted-foreground"
                  : "bg-secondary text-muted-foreground/80";
          return (
            <li
              key={tier.pts}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-xl bg-card p-5 ring-1 transition-shadow hover:shadow-lg",
                accentRing,
              )}
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "grid size-9 place-items-center rounded-md",
                    accentBg,
                  )}
                >
                  <tier.Icon className="size-4" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} / 04
                </span>
              </div>
              <div className="mt-8">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-5xl font-semibold leading-none tracking-tight tabular-nums">
                    {tier.pts}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    pts
                  </span>
                </div>
                <div className="mt-2 font-heading text-base font-semibold tracking-tight">
                  {tier.title}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tier.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-sm text-muted-foreground">
        Tie-breakers, daily windows, and the dirty details live in{" "}
        <Link
          href="/how-it-works"
          className="font-medium text-foreground underline underline-offset-4 hover:text-pitch"
        >
          how it works
        </Link>
        .
      </p>
    </section>
  );
}

function Cadence() {
  const items: Array<{ tag: string; label: string; copy: string }> = [
    {
      tag: "01",
      label: "Pick",
      copy: "Submit a score for every fixture, edit until kickoff.",
    },
    {
      tag: "02",
      label: "Lock",
      copy: "Predictions freeze the moment the ball rolls — enforced at the database.",
    },
    {
      tag: "03",
      label: "Score",
      copy: "Points post instantly when an admin enters the final score.",
    },
    {
      tag: "04",
      label: "Climb",
      copy: "Daily and overall leaderboards refresh in real time.",
    },
  ];

  return (
    <section className="border-t border-border/70 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            02 · Cadence
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Pick → Lock → Score → Climb
          </p>
        </div>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((step) => (
            <li
              key={step.tag}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  {step.tag}
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-pitch">
                  {step.label}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{step.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
