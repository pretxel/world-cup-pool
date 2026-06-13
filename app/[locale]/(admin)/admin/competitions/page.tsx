import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getManagedCompetitionId } from "@/lib/admin/managed-competition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SetActiveDialog } from "@/components/admin/set-active-dialog";
import {
  deleteCompetition,
  setManagedCompetition,
} from "./actions";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const WC_SEED_SLUG = "world-cup-2026";

export default async function AdminCompetitionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const admin = createAdminSupabaseClient();
  const [{ data: competitions }, managedId] = await Promise.all([
    admin
      .from("competitions")
      .select("id, slug, name, short_name, season, is_active")
      .order("season", { ascending: false }),
    getManagedCompetitionId(),
  ]);

  const rows = competitions ?? [];
  const activeName = rows.find((c) => c.is_active)?.name ?? null;

  // Fixture counts (few competitions → a small fan-out of head counts).
  const fixtureCounts = new Map<string, number>();
  await Promise.all(
    rows.map(async (c) => {
      const { count } = await admin
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", c.id);
      fixtureCounts.set(c.id, count ?? 0);
    }),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Competitions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage competitions. Exactly one is live to visitors.
          </p>
        </div>
        <Link
          href={localePath(locale, "/admin/competitions/new")}
          className="shrink-0"
        >
          <Button size="sm">New competition</Button>
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          No competitions yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => {
            const isManaged = c.id === managedId;
            const fixtures = fixtureCounts.get(c.id) ?? 0;
            const deletable = !c.is_active && c.slug !== WC_SEED_SLUG && fixtures === 0;
            return (
              <li key={c.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.is_active ? <Badge>Active</Badge> : null}
                  {isManaged ? <Badge variant="outline">Managing</Badge> : null}
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.slug}
                  </span>
                  {c.season ? (
                    <span className="text-xs text-muted-foreground">· {c.season}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    · {fixtures} fixtures
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!isManaged ? (
                    <form action={setManagedCompetition}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Manage
                      </Button>
                    </form>
                  ) : null}

                  {!c.is_active ? (
                    <SetActiveDialog
                      id={c.id}
                      name={c.name}
                      currentActiveName={activeName}
                      hasFixtures={fixtures > 0}
                    />
                  ) : null}

                  <Link href={localePath(locale, `/admin/competitions/${c.id}`)}>
                    <Button size="sm" variant="ghost">
                      Edit
                    </Button>
                  </Link>

                  {deletable ? (
                    <form action={deleteCompetition}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" size="sm" variant="destructive">
                        Delete
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
