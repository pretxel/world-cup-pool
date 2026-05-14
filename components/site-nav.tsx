import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";

export async function SiteNav() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = data?.is_admin ?? false;
  }

  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-sm font-bold tracking-tight">
          WC26 Pool
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link href="/matches" className="rounded px-3 py-1.5 hover:bg-muted">
            Matches
          </Link>
          <Link href="/leaderboard" className="rounded px-3 py-1.5 hover:bg-muted">
            Leaderboard
          </Link>
          {user ? (
            <Link href="/my-picks" className="rounded px-3 py-1.5 hover:bg-muted">
              My picks
            </Link>
          ) : null}
          {isAdmin ? (
            <Link href="/admin/matches" className="rounded px-3 py-1.5 hover:bg-muted">
              Admin
            </Link>
          ) : null}
          {user ? (
            <form action="/sign-out" method="post">
              <Button type="submit" size="sm" variant="ghost">
                Sign out
              </Button>
            </form>
          ) : (
            <Link href="/sign-in" className={buttonVariants({ size: "sm" })}>
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-xs text-muted-foreground">
        <span>World Cup 2026 Pool</span>
        <Link href="/how-it-works" className="hover:underline">
          How it works
        </Link>
      </div>
    </footer>
  );
}
