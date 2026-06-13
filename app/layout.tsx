import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Bricolage_Grotesque, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getLocale } from "next-intl/server";
import { env } from "@/lib/env";
import { getActiveBranding } from "@/lib/competition";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = env.siteUrl;

// Root metadata is the English fallback; brand strings come from the active
// competition (localized title/description live in [locale]/layout via siteMeta).
export async function generateMetadata(): Promise<Metadata> {
  const branding = await getActiveBranding();
  const siteName = branding.siteName;
  const defaultTitle = `${siteName} — Daily Predictions & Live Leaderboard`;
  const defaultDescription = `Predict every ${branding.shortName} match. Submit scores before kickoff, earn points on results, and climb a daily and overall leaderboard.`;
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: defaultTitle,
      template: `%s · ${branding.brandCode} Pool`,
    },
    description: defaultDescription,
    applicationName: siteName,
    keywords: [
      branding.shortName,
      `${branding.shortName} pool`,
      "score prediction game",
      "soccer pool",
      "football predictor",
      `${branding.shortName} leaderboard`,
      "daily predictions",
      branding.brandCode,
    ],
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    alternates: {
      canonical: siteUrl,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      // Tells Facebook the page is also available in these languages.
      alternateLocale: ["es_ES", "fr_FR"],
      url: siteUrl,
      siteName,
      title: defaultTitle,
      description: defaultDescription,
      // og:image is supplied by the file convention app/opengraph-image.tsx,
      // which also emits og:image:width/height/type/alt. Defining images here
      // too would produce a duplicate og:image with no og:image:type.
    },
    ...(env.facebookAppId ? { facebook: { appId: env.facebookAppId } } : {}),
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: ["/opengraph-image.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    manifest: "/site.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark light",
};

function buildJsonLd(siteName: string, description: string) {
  return {
    website: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      url: siteUrl,
      description,
      inLanguage: "en-US",
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/matches?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    organization: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteName,
      url: siteUrl,
      logo: `${siteUrl}/opengraph-image`,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Tag <html> with the request's resolved locale (middleware sets it) so es/fr
  // pages aren't announced as English to assistive tech and search engines.
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const branding = await getActiveBranding();
  const jsonLd = buildJsonLd(
    branding.siteName,
    `Predict every ${branding.shortName} match. Submit scores before kickoff, earn points on results, and climb a daily and overall leaderboard.`,
  );
  return (
    <html
      lang={locale}
      dir="ltr"
      suppressHydrationWarning
      className={`${manrope.variable} ${bricolage.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
        <Script
          id="ld-website"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.website) }}
        />
        <Script
          id="ld-organization"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd.organization),
          }}
        />
        {env.gaMeasurementId ? (
          <>
            <Script
              id="ga-loader"
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${env.gaMeasurementId}`}
            />
            <Script
              id="ga-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${env.gaMeasurementId}');`,
              }}
            />
          </>
        ) : null}
      </body>
    </html>
  );
}
