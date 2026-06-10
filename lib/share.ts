import { localePath, type Locale } from "@/lib/i18n";

// Mirrors the prediction form's MAX_GOALS; share URLs are user-editable so
// the clamp is the only guarantee the rendered numbers stay sane.
export const MAX_SHARE_GOALS = 20;

export function clampGoals(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_SHARE_GOALS, Math.max(0, Math.floor(n)));
}

export function buildPickSharePath(
  locale: Locale,
  matchId: string,
  homeGoals: number,
  awayGoals: number,
): string {
  const h = clampGoals(homeGoals) ?? 0;
  const a = clampGoals(awayGoals) ?? 0;
  return `${localePath(locale, `/share/pick/${matchId}`)}?h=${h}&a=${a}`;
}

export function buildTweetIntentUrl(text: string, url: string): string {
  const params = new URLSearchParams({ text, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function buildFacebookShareUrl(url: string): string {
  const params = new URLSearchParams({ u: url });
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}
