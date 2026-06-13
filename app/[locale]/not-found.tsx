import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { isLocale, localePath, DEFAULT_LOCALE } from "@/lib/i18n";

export default async function LocaleNotFound() {
  const t = await getTranslations("notFound");
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/football.svg"
        alt=""
        aria-hidden="true"
        width={144}
        height={144}
        className="mb-4 h-28 w-28 sm:h-36 sm:w-36"
      />
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        {t("eyebrow")}
      </p>
      <h1
        className="mt-2 font-heading text-6xl font-semibold leading-none tracking-tight sm:text-7xl"
        style={{ fontStretch: "condensed" }}
      >
        {t("code")}
      </h1>
      <p className="mt-4 max-w-sm text-sm text-muted-foreground">{t("body")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={localePath(locale, "/")} className={buttonVariants()}>
          {t("backHome")}
        </Link>
        <Link
          href={localePath(locale, "/matches")}
          className={buttonVariants({ variant: "outline" })}
        >
          {t("browseMatches")}
        </Link>
      </div>
    </main>
  );
}
