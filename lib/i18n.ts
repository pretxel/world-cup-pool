export const SUPPORTED_LOCALES = ["en", "es", "fr", "de"] as const;
export const DEFAULT_LOCALE: Locale = "en";

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function localePath(locale: Locale, path: string): string {
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  if (trimmed === "/") return `/${locale}`;
  return `/${locale}${trimmed}`;
}

// Labels for every locale we *plan* to support; the active subset is
// SUPPORTED_LOCALES above. The switcher iterates SUPPORTED_LOCALES and pulls
// from this map.
export const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

// Flag slug used to render the locale's flag in the language switcher.
// Pragmatic en→us for the WC26 host-nation context. Switch to gb-eng if
// preferred — one-line change.
export const LOCALE_FLAG_SLUG: Record<Locale, string> = {
  en: "us",
  es: "es",
  fr: "fr",
  de: "de",
};
