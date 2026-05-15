"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MenuIcon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { LocaleList } from "@/components/language-switcher";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({
  links,
  className,
}: {
  links: NavLink[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <ul className={cn("items-center gap-0.5 text-sm", className)}>
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex items-center rounded-md px-3 py-1.5 font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-pitch"
                />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function MobileNav({
  links,
  signedIn,
  className,
}: {
  links: NavLink[];
  signedIn: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = React.useState(pathname);
  const tLang = useTranslations("languageSwitcher");

  // Close the mobile drawer when the route changes. React's "store info from
  // previous render" pattern — keeps the close logic out of an effect.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className={className}>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <XIcon /> : <MenuIcon />}
      </Button>
      {open ? (
        <div
          className="fixed inset-x-0 top-[3.25rem] z-30 border-b border-border bg-background/95 backdrop-blur"
          role="dialog"
          aria-label="Site menu"
        >
          <ul className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-3 text-sm">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "flex items-center justify-between rounded-md px-3 py-2.5 font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span>{link.label}</span>
                    {active ? (
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-pitch"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
            <li className="mt-2 border-t border-border pt-3">
              <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {tLang("label")}
              </p>
              <LocaleList onAfterChange={() => setOpen(false)} />
            </li>
            <li className="mt-2 border-t border-border pt-3">
              {signedIn ? (
                <form action="/sign-out" method="post">
                  <Button type="submit" variant="outline" size="sm" className="w-full">
                    Sign out
                  </Button>
                </form>
              ) : (
                <Link
                  href="/sign-in"
                  className={buttonVariants({ size: "sm", className: "w-full" })}
                >
                  Sign in
                </Link>
              )}
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
