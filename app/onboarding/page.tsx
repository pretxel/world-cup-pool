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
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">Pick a display name</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        This is what other players will see on the leaderboard. 2–32 characters.
      </p>
      <form action={setDisplayName} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            name="display_name"
            required
            minLength={2}
            maxLength={32}
            placeholder="e.g. Lionel A."
          />
        </div>
        <Button type="submit" className="w-full">
          Save and continue
        </Button>
      </form>
    </main>
  );
}
