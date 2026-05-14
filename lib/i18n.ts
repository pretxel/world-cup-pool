// Staged rollout: this PR ships foundation + English only. The es and fr
// locale message bundles arrive in the next PR — at which point we widen this
// list, no other code changes required.
export const SUPPORTED_LOCALES = ["en"] as const;
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
};
