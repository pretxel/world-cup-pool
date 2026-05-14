import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { NavLinks, MobileNav } from "@/components/site-nav-client";
import { ThemeToggle } from "@/components/theme-toggle";

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

  const links = [
    { href: "/matches", label: "Matches" },
    { href: "/leaderboard", label: "Leaderboard" },
    ...(user ? [{ href: "/my-picks", label: "My picks" }] : []),
    ...(isAdmin ? [{ href: "/admin/matches", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group/brand flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md bg-pitch text-pitch-foreground ring-1 ring-pitch/40"
          >
            <span className="font-mono text-[10px] font-bold leading-none tracking-tight">
              26
            </span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span
              className="font-heading text-sm font-semibold tracking-tight text-foreground"
              style={{ fontStretch: "condensed" }}
            >
              WC26
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">
              Pool
            </span>
          </span>
        </Link>

        <NavLinks links={links} className="hidden md:flex" />

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {user ? (
            <form action="/sign-out" method="post" className="hidden sm:block">
              <Button type="submit" size="sm" variant="ghost">
                Sign out
              </Button>
            </form>
          ) : (
            <Link
              href="/sign-in"
              className={buttonVariants({ size: "sm", className: "hidden sm:inline-flex" })}
            >
              Sign in
            </Link>
          )}
          <MobileNav links={links} signedIn={!!user} className="md:hidden" />
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-5 place-items-center rounded-sm bg-pitch text-pitch-foreground"
          >
            <span className="font-mono text-[8px] font-bold leading-none">26</span>
          </span>
          <span className="font-mono uppercase tracking-[0.2em]">
            WC26 Pool · 11 Jun – 19 Jul 2026
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/how-it-works" className="hover:text-foreground hover:underline">
            How it works
          </Link>
          <span className="text-muted-foreground/70">USA · Canada · Mexico</span>
        </div>
      </div>
    </footer>
  );
}
