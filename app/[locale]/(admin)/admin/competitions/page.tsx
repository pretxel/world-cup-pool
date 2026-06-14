import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PlusIcon, TrophyIcon } from "lucide-react";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getManagedCompetitionId } from "@/lib/admin/managed-competition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusCard } from "@/components/admin/status-card";
import { EmptyState } from "@/components/admin/empty-state";
import { SubmitButton } from "@/components/admin/submit-button";
import { SetActiveDialog } from "@/components/admin/set-active-dialog";
import { deleteCompetition, setManagedCompetition } from "./actions";
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

  const t = await getTranslations("admin");

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
      <div className="admin-reveal space-y-8">
        <AdminPageHeader
          title={t("competitions.title")}
          description={t("competitions.description")}
          actions={
            <Link href={localePath(locale, "/admin/competitions/new")}>
              <Button>
                <PlusIcon aria-hidden />
                {t("competitions.new")}
              </Button>
            </Link>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<TrophyIcon />}
            title={t("competitions.emptyTitle")}
            description={t("competitions.emptyBody")}
            action={
              <Link href={localePath(locale, "/admin/competitions/new")}>
                <Button>
                  <PlusIcon aria-hidden />
                  {t("competitions.new")}
                </Button>
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-4">
            {rows.map((c) => {
              const isManaged = c.id === managedId;
              const fixtures = fixtureCounts.get(c.id) ?? 0;
              const deletable =
                !c.is_active && c.slug !== WC_SEED_SLUG && fixtures === 0;
              return (
                <li key={c.id}>
                  <StatusCard
                    label={c.slug}
                    value={c.name}
                    badges={
                      <>
                        {c.is_active ? (
                          <Badge>{t("competitions.badgeActive")}</Badge>
                        ) : null}
                        {isManaged ? (
                          <Badge variant="outline">
                            {t("competitions.badgeManaging")}
                          </Badge>
                        ) : null}
                      </>
                    }
                    meta={
                      <>
                        {c.season ? (
                          <span>{t("competitions.season", { season: c.season })}</span>
                        ) : null}
                        {c.season ? <span aria-hidden>·</span> : null}
                        <span>{t("competitions.fixtures", { count: fixtures })}</span>
                      </>
                    }
                    actions={
                      <>
                        {!isManaged ? (
                          <form action={setManagedCompetition}>
                            <input type="hidden" name="id" value={c.id} />
                            <SubmitButton size="sm" variant="outline">
                              {t("competitions.manage")}
                            </SubmitButton>
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

                        <Link
                          href={localePath(locale, `/admin/competitions/${c.id}`)}
                        >
                          <Button size="sm" variant="ghost">
                            {t("competitions.edit")}
                          </Button>
                        </Link>

                        {deletable ? (
                          <form action={deleteCompetition} className="ml-auto">
                            <input type="hidden" name="id" value={c.id} />
                            <SubmitButton
                              size="sm"
                              variant="destructive"
                              confirmText={t("competitions.deleteConfirm", {
                                name: c.name,
                              })}
                            >
                              {t("competitions.delete")}
                            </SubmitButton>
                          </form>
                        ) : null}
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
