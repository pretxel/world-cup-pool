import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  TrophyIcon,
  CalendarClockIcon,
  CircleHelpIcon,
  LayoutDashboardIcon,
  ArrowRightIcon,
} from "lucide-react";
import { getActiveCompetition } from "@/lib/competition";
import { getManagedCompetition } from "@/lib/admin/managed-competition";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusCard } from "@/components/admin/status-card";
import { EmptyState } from "@/components/admin/empty-state";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

type Counts = { fixtures: number; final: number };

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("admin");

  const admin = createAdminSupabaseClient();
  const [active, managed, { count: competitionCount }] = await Promise.all([
    getActiveCompetition(),
    getManagedCompetition(),
    admin.from("competitions").select("id", { count: "exact", head: true }),
  ]);
  const hasAny = (competitionCount ?? 0) > 0;

  async function countsFor(id: string): Promise<Counts> {
    const [{ count: fixtures }, { count: final }] = await Promise.all([
      admin
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", id),
      admin
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", id)
        .eq("status", "final"),
    ]);
    return { fixtures: fixtures ?? 0, final: final ?? 0 };
  }

  const [activeCounts, managedCounts] = await Promise.all([
    active ? countsFor(active.id) : Promise.resolve(null),
    managed ? countsFor(managed.id) : Promise.resolve(null),
  ]);

  const links = [
    {
      href: "/admin/competitions",
      title: t("dashboard.linkCompetitions"),
      body: t("dashboard.linkCompetitionsBody"),
      icon: <TrophyIcon aria-hidden />,
    },
    {
      href: "/admin/matches",
      title: t("dashboard.linkFixtures"),
      body: t("dashboard.linkFixturesBody"),
      icon: <CalendarClockIcon aria-hidden />,
    },
    {
      href: "/admin/quiz",
      title: t("dashboard.linkQuiz"),
      body: t("dashboard.linkQuizBody"),
      icon: <CircleHelpIcon aria-hidden />,
    },
  ];

  const fixturesMeta = (c: Counts) => (
    <>
      <span>{t("dashboard.fixturesCount", { count: c.fixtures })}</span>
      <span aria-hidden>·</span>
      <span>{t("dashboard.finalCount", { count: c.final })}</span>
    </>
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="admin-reveal space-y-8">
        <AdminPageHeader
          eyebrow={t("dashboard.eyebrow")}
          title={t("dashboard.title")}
          description={t("dashboard.description")}
        />

        {hasAny ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatusCard
                label={t("dashboard.liveLabel")}
                value={active?.name ?? t("dashboard.none")}
                badges={
                  active ? <Badge>{t("competitions.badgeActive")}</Badge> : null
                }
                meta={activeCounts ? fixturesMeta(activeCounts) : null}
              />
              <StatusCard
                label={t("dashboard.managedLabel")}
                value={managed?.name ?? t("dashboard.none")}
                badges={
                  managed ? (
                    <Badge variant="outline">
                      {t("competitions.badgeManaging")}
                    </Badge>
                  ) : null
                }
                meta={managedCounts ? fixturesMeta(managedCounts) : null}
              />
            </div>

            <section className="space-y-3">
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("dashboard.quickLinks")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={localePath(locale, link.href)}
                    className="group/link rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Card className="h-full gap-2 p-4 transition-colors group-hover/link:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4.5">
                          {link.icon}
                        </span>
                        <ArrowRightIcon
                          aria-hidden
                          className="size-4 text-muted-foreground transition-transform group-hover/link:translate-x-0.5"
                        />
                      </div>
                      <div className="mt-1 font-heading font-medium">
                        {link.title}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {link.body}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : (
          <EmptyState
            icon={<LayoutDashboardIcon />}
            title={t("dashboard.emptyTitle")}
            description={t("dashboard.emptyBody")}
            action={
              <Link href={localePath(locale, "/admin/competitions/new")}>
                <Button>{t("dashboard.emptyAction")}</Button>
              </Link>
            }
          />
        )}
      </div>
    </main>
  );
}
