import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeftIcon } from "lucide-react";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveCompetition } from "@/lib/competition";
import { CompetitionForm } from "@/components/admin/competition-form";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
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

  const t = await getTranslations("admin");

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
      <div className="admin-reveal space-y-8">
        <div className="space-y-3">
          <Link
            href={localePath(locale, "/admin/competitions")}
            className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            {t("form.backToCompetitions")}
          </Link>
          <AdminPageHeader
            title={row.name}
            actions={
              row.is_active ? (
                <Badge>{t("competitions.badgeActive")}</Badge>
              ) : (
                <SetActiveDialog
                  id={row.id}
                  name={row.name}
                  currentActiveName={activeName}
                  hasFixtures={hasFixtures}
                />
              )
            }
          />
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
      </div>
    </main>
  );
}
