import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeftIcon } from "lucide-react";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  return {
    title: t("title"),
    description: t("ogDescription"),
    alternates: { canonical: "/how-it-works" },
    openGraph: {
      title: `${t("title")} · WC26 Pool`,
      description: t("description"),
      url: "/how-it-works",
      type: "website",
    },
  };
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("howItWorks");
  const tCommon = await getTranslations("common");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href={localePath(locale, "/")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        {tCommon("home")}
      </Link>

      <header className="mt-5 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          {t("lede")}
        </p>
      </header>

      <Section index="01" title={t("section1Title")}>
        <p>{t("section1P1")}</p>
        <p className="mt-3">{t("section1P2")}</p>
      </Section>

      <Section index="02" title={t("section2Title")}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            { pts: 5, label: t("section2Tier5") },
            { pts: 3, label: t("section2Tier3") },
            { pts: 1, label: t("section2Tier1") },
            { pts: 0, label: t("section2Tier0") },
          ].map((row) => (
            <li
              key={row.pts}
              className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
            >
              <span className="font-mono text-3xl font-semibold tabular-nums text-pitch">
                {row.pts}
              </span>
              <span className="text-sm">{row.label}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section index="03" title={t("section3Title")}>
        <p>{t("section3Intro")}</p>
        <ol className="mt-3 grid gap-2">
          {[t("section3Item1"), t("section3Item2"), t("section3Item3")].map(
            (line, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-pitch text-pitch-foreground font-mono text-[11px] font-bold tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm">{line}</span>
              </li>
            ),
          )}
        </ol>
      </Section>

      <Section index="04" title={t("section4Title")}>
        <p>{t("section4P1")}</p>
        <p className="mt-3">{t("section4P2")}</p>
      </Section>
    </main>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {index}
        </span>
        <span
          className="font-heading text-2xl font-semibold tracking-tight"
          style={{ fontStretch: "condensed" }}
        >
          {title}
        </span>
      </h2>
      <div className="mt-4 text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&>p]:text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
