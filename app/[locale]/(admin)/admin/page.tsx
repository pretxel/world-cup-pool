import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { getActiveCompetition } from "@/lib/competition";
import { getManagedCompetition } from "@/lib/admin/managed-competition";
import { Card } from "@/components/ui/card";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const [active, managed] = await Promise.all([
    getActiveCompetition(),
    getManagedCompetition(),
  ]);

  const tiles = [
    { href: "/admin/competitions", title: "Competitions", body: "Create, edit, and activate competitions." },
    { href: "/admin/matches", title: "Fixtures & results", body: "Scoped to the managed competition." },
    { href: "/admin/quiz", title: "Quiz", body: "Daily quiz — applies to all competitions." },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Admin
      </h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Live competition (public)
          </div>
          <div className="mt-1 text-lg font-medium">
            {active?.name ?? "None"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Managing (your editing context)
          </div>
          <div className="mt-1 text-lg font-medium">
            {managed?.name ?? "None"}
          </div>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.href} href={localePath(locale, tile.href)}>
            <Card className="h-full p-4 transition-colors hover:bg-muted/40">
              <div className="font-medium">{tile.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {tile.body}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
