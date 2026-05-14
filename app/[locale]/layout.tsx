import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { SUPPORTED_LOCALES, isLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
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
