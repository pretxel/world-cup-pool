"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useTransition, type ChangeEvent } from "react";
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  isLocale,
  type Locale,
} from "@/lib/i18n";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function LanguageSwitcher() {
  const current = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("languageSwitcher");
  const [, startTransition] = useTransition();

  function onChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (!isLocale(next) || next === current) return;

    document.cookie = `NEXT_LOCALE=${next}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;

    const stripped = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
    const target = `/${next}${stripped === "/" ? "" : stripped}` || `/${next}`;

    startTransition(() => {
      router.replace(target);
      router.refresh();
    });
  }

  return (
    <label className="sr-only" htmlFor="lang-switcher">
      {t("label")}
      <select
        id="lang-switcher"
        value={current}
        onChange={onChange}
        aria-label={t("label")}
        className="ml-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring not-sr-only"
      >
        {SUPPORTED_LOCALES.map((loc: Locale) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
    </label>
  );
}
