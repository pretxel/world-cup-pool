import Link from "next/link";
import { localePath, type Locale } from "@/lib/i18n";
import { ManagedContextBar } from "@/components/admin/managed-context-bar";

const NAV: { href: string; label: string }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/competitions", label: "Competitions" },
  { href: "/admin/matches", label: "Fixtures" },
  { href: "/admin/quiz", label: "Quiz" },
];

export function AdminShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 py-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={localePath(locale, n.href)}
              className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <ManagedContextBar />
      {children}
    </div>
  );
}
