import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { CompetitionForm } from "@/components/admin/competition-form";
import { createCompetition } from "../actions";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export default async function NewCompetitionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 border-b border-border pb-4">
        <Link
          href={localePath(locale, "/admin/competitions")}
          className="text-sm text-muted-foreground underline"
        >
          ← Competitions
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
          New competition
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Created inactive. Activate it from the competitions list when ready.
        </p>
      </div>
      <CompetitionForm action={createCompetition} locale={locale} />
    </main>
  );
}
