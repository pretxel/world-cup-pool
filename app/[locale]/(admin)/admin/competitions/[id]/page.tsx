import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveCompetition } from "@/lib/competition";
import { CompetitionForm } from "@/components/admin/competition-form";
import { SetActiveDialog } from "@/components/admin/set-active-dialog";
import { updateCompetition } from "../actions";
import { Badge } from "@/components/ui/badge";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export default async function EditCompetitionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const admin = createAdminSupabaseClient();
  const { data: row } = await admin
    .from("competitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const resolved = resolveCompetition(row);
  const { count: fixtureCount } = await admin
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", id);
  const hasFixtures = (fixtureCount ?? 0) > 0;

  const activeName = row.is_active
    ? row.name
    : ((
        await admin
          .from("competitions")
          .select("name")
          .eq("is_active", true)
          .maybeSingle()
      ).data?.name ?? null);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 border-b border-border pb-4">
        <Link
          href={localePath(locale, "/admin/competitions")}
          className="text-sm text-muted-foreground underline"
        >
          ← Competitions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {row.name}
          </h1>
          {row.is_active ? <Badge>Active</Badge> : null}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {!row.is_active ? (
            <SetActiveDialog
              id={row.id}
              name={row.name}
              currentActiveName={activeName}
              hasFixtures={hasFixtures}
            />
          ) : null}
        </div>
      </div>

      <CompetitionForm
        action={updateCompetition}
        locale={locale}
        slugLocked={hasFixtures}
        initial={{
          id: row.id,
          slug: row.slug,
          kind: row.kind,
          name: row.name,
          short_name: row.short_name,
          season: row.season ?? undefined,
          tournament_start_at: row.tournament_start_at,
          tournament_end_at: row.tournament_end_at ?? undefined,
          opening_home: row.opening_home ?? undefined,
          opening_away: row.opening_away ?? undefined,
          opening_venue: row.opening_venue ?? undefined,
          format: resolved.format,
          providers: resolved.providersConfig,
          branding: resolved.brandingConfig,
        }}
      />
    </main>
  );
}
