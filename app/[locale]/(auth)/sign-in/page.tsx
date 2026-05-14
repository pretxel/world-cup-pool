import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignInForm } from "./sign-in-form";
import { TargetIcon, TrophyIcon, ZapIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to the World Cup 2026 Pool with a magic-link email to submit predictions and join the leaderboard.",
  alternates: { canonical: "/sign-in" },
  robots: { index: false, follow: true },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next ?? "/matches");
  }

  return (
    <main className="relative isolate min-h-[calc(100vh-9rem)] overflow-hidden">
      {/* Stadium-stripe accent in the corner */}
      <div
        aria-hidden
        className="bg-pitch-stripes absolute -right-32 -top-32 h-[36rem] w-[36rem] -rotate-12 opacity-[0.08] dark:opacity-[0.18]"
        style={{
          maskImage:
            "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
        }}
      />
      <div className="bg-grain pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid max-w-5xl gap-12 px-4 py-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <section className="hidden flex-col gap-6 lg:flex">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Welcome to the box
          </p>
          <h1
            className="font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl"
            style={{ fontStretch: "condensed" }}
          >
            <span className="block">One pool.</span>
            <span className="block text-pitch">Every match.</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            We use your email only to identify your picks. No spam, no daily
            recap blasts — just enough to put your name on the leaderboard.
          </p>

          <ul className="mt-2 grid gap-3">
            {[
              { Icon: TargetIcon, title: "Exact-score picks", copy: "Submit a precise scoreline for every fixture before kickoff." },
              { Icon: ZapIcon, title: "Live scoring", copy: "Standings shift the moment an admin enters a final score." },
              { Icon: TrophyIcon, title: "Daily + overall", copy: "Climb today's board and the tournament-wide table at the same time." },
            ].map((b) => (
              <li
                key={b.title}
                className="flex items-start gap-3 rounded-lg border border-border bg-card/60 p-3 backdrop-blur"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-pitch/10 text-pitch ring-1 ring-pitch/20">
                  <b.Icon className="size-4" />
                </span>
                <div>
                  <div className="font-heading text-sm font-semibold tracking-tight">
                    {b.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{b.copy}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full max-w-md justify-self-center lg:justify-self-end">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] dark:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.55)] sm:p-8">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-md bg-pitch text-pitch-foreground"
              >
                <span className="font-mono text-[10px] font-bold leading-none">
                  26
                </span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                WC26 Pool · Sign in
              </span>
            </div>
            <h2
              className="mt-4 font-heading text-3xl font-semibold tracking-tight"
              style={{ fontStretch: "condensed" }}
            >
              Lock in your picks.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use your email. We&apos;ll create the account on the fly if it&apos;s your first time.
            </p>

            <div className="mt-6">
              <SignInForm next={next} />
            </div>

            <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
              New here? Just enter your email — your account is created instantly.{" "}
              <Link
                href="/how-it-works"
                className="font-medium text-foreground underline-offset-4 hover:text-pitch hover:underline"
              >
                How it works
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
