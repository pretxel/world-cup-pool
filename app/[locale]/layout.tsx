import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { getActiveBranding } from "@/lib/competition";
import {
  SUPPORTED_LOCALES,
  isLocale,
  DEFAULT_LOCALE,
  type Locale,
} from "@/lib/i18n";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
};
const ALT_LOCALES: Record<Locale, string[]> = {
  en: ["es_ES", "fr_FR"],
  es: ["en_US", "fr_FR"],
  fr: ["en_US", "es_ES"],
};

// Localized site-wide title/description/og/twitter. Metadata is shallow-merged
// and nested objects are overwritten by the deepest segment, so og/twitter are
// re-specified in full here (localized) rather than inheriting the root's
// English defaults. Individual pages still override their own title/og.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "siteMeta" });
  const branding = await getActiveBranding();
  const title = t("title");
  const description = t("description");
  return {
    title: { default: title, template: `%s · ${branding.brandCode} Pool` },
    description,
    openGraph: {
      type: "website",
      locale: OG_LOCALE[locale],
      alternateLocale: ALT_LOCALES[locale],
      siteName: branding.siteName,
      title,
      description,
      // og:image is supplied by app/opengraph-image.tsx (file convention).
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image.png"],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <SiteNav />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}
