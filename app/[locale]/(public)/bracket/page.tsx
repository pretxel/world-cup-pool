import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BracketView } from "@/components/bracket-view";
import { getBracket } from "@/lib/bracket";
import { KNOCKOUT_ORDER } from "@/lib/bracket-core";
import { getActiveCompetition } from "@/lib/competition";
import { getStageLabel } from "@/lib/competition-schema";
import { maybeScheduleOpportunisticSync } from "@/lib/result-sync/opportunistic";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bracket" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/bracket" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/bracket",
      type: "website",
    },
  };
}

export default async function BracketPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("bracket");
  const [{ rounds, matches, hasKnockout }, competition] = await Promise.all([
    getBracket(),
    getActiveCompetition(),
  ]);

  // Cron-not-firing safety net: refresh overdue results after the response.
  maybeScheduleOpportunisticSync(matches);

  // Localized round names from the active competition's format, falling back to
  // the raw stage key when no competition resolves.
  const stage: Record<string, string> = {};
  for (const key of KNOCKOUT_ORDER) {
    stage[key] = competition
      ? getStageLabel(competition.format, key, locale)
      : key;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
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
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("lede")}</p>
      </header>

      {hasKnockout ? (
        <BracketView
          rounds={rounds}
          labels={{
            stage,
            provisional: t("provisional"),
            thirdPlace: stage.third ?? t("thirdPlace"),
          }}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("emptyTitle")}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm">{t("emptyBody")}</p>
        </div>
      )}
    </main>
  );
}
