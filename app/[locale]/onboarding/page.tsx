import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { setDisplayName } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Choose a display name" };

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (profile?.display_name) redirect("/matches");

  return (
    <main className="relative isolate mx-auto flex min-h-[80vh] max-w-lg flex-col justify-center px-6 py-12">
      <div
        aria-hidden
        className="bg-pitch-stripes absolute -right-40 -top-20 h-[28rem] w-[28rem] -rotate-12 opacity-[0.08] dark:opacity-[0.18]"
        style={{
          maskImage:
            "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
        }}
      />
      <div className="relative">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Last step
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight"
          style={{ fontStretch: "condensed" }}
        >
          Pick a display name
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This is the name other players see on the leaderboard. 2–32 characters.
        </p>

        <form
          action={setDisplayName}
          className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="display_name"
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
            >
              Display name
            </Label>
            <Input
              id="display_name"
              name="display_name"
              required
              minLength={2}
              maxLength={32}
              placeholder="e.g. Lionel A."
              className="h-11 text-base"
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full gap-2 text-sm font-semibold uppercase tracking-[0.14em]"
          >
            Save and continue
          </Button>
        </form>
      </div>
    </main>
  );
}
