import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GroupStandingsTable } from "@/components/group-standings-table";
import { getGroupTables } from "@/lib/group-table";
import { maybeScheduleOpportunisticSync } from "@/lib/result-sync/opportunistic";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "groupStandings" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/standings" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/standings",
      type: "website",
    },
  };
}

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("groupStandings");
  const { groups, matches, hasGroupStage } = await getGroupTables();

  // Cron-not-firing safety net: piggyback on this render to refresh any
  // overdue result (debounced inside; runs after the response is sent).
  maybeScheduleOpportunisticSync(matches);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("lede")}</p>
      </header>

      {hasGroupStage && groups.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <GroupStandingsTable
              key={group.groupCode}
              groupCode={group.groupCode}
              rows={group.rows}
              source="results"
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("noGroupStageTitle")}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm">{t("noGroupStageBody")}</p>
        </div>
      )}
    </main>
  );
}
