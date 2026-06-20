// Daily-quiz helpers shared by the page and tests.

import type { Locale } from "@/lib/i18n";

/**
 * Per-locale quiz content. English lives in the base prompt/options columns;
 * this only carries the non-English translations. `options[i]` corresponds
 * positionally to the English `options[i]`, so the stored `correct_index`
 * grades every locale identically — translations never reorder.
 */
export type QuizTranslation = { prompt: string; options: string[] };
export type QuizTranslations = Partial<Record<Locale, QuizTranslation>>;

type LocalizableQuestion = {
  prompt: string;
  options: string[];
  translations?: unknown;
};

function isUsableTranslation(
  value: unknown,
  englishOptionCount: number,
): value is QuizTranslation {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  if (typeof t.prompt !== "string" || t.prompt.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(t.options) || t.options.length !== englishOptionCount) {
    return false;
  }
  return t.options.every(
    (o) => typeof o === "string" && o.trim().length > 0,
  );
}

/**
 * Resolve a question's prompt + options for a locale. Returns the English base
 * columns for `en`, a missing translation, or any malformed/partial/length-
 * mismatched translation — falling back wholesale so a question is never shown
 * half-translated and `correct_index` stays valid against the returned options.
 */
export function localizeQuizQuestion(
  question: LocalizableQuestion,
  locale: Locale,
): { prompt: string; options: string[] } {
  const base = { prompt: question.prompt, options: question.options };
  if (locale === "en") return base;

  const translations = question.translations;
  if (typeof translations !== "object" || translations === null) return base;

  const candidate = (translations as Record<string, unknown>)[locale];
  if (!isUsableTranslation(candidate, question.options.length)) return base;

  return { prompt: candidate.prompt, options: candidate.options };
}

/** UTC YYYY-MM-DD key for a date. */
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Current streak: the number of consecutive UTC days, ending today or
 * yesterday, on which the user answered. Today-not-yet-answered does not break
 * a streak (they still have the day), but a missed in-between day does.
 *
 * A `frozenDays` set of consumed-freeze UTC day-keys forgives single isolated
 * one-day gaps: a missed day that is frozen counts toward the streak and the
 * walk steps over it, but only when the day beyond it has activity (so a freeze
 * at the natural end of the run never invents activity, and a two-day gap with
 * only one frozen day still breaks). With no `frozenDays` (the default), this is
 * byte-for-byte identical to the original behavior.
 *
 * @param answeredAt ISO timestamps of the user's answers (any order, any tz).
 * @param now reference instant (injectable for tests).
 * @param frozenDays UTC day-keys the user holds a consumed freeze for.
 */
export function computeStreak(
  answeredAt: string[],
  now: Date = new Date(),
  frozenDays: Set<string> = new Set(),
): number {
  const days = new Set(answeredAt.map((iso) => utcDayKey(new Date(iso))));
  if (days.size === 0) return 0;

  // Anchor at today (UTC midnight). If today has no answer, the streak can
  // still be alive from yesterday backwards; otherwise it's zero. A freeze is
  // never spent on the anchor itself (the day is still open / there is nothing
  // before it to bridge), so anchoring uses real activity only.
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (!days.has(utcDayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(utcDayKey(cursor))) return 0;
  }

  let streak = 0;
  for (;;) {
    const key = utcDayKey(cursor);
    if (days.has(key)) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      continue;
    }
    // No activity on this day. A consumed freeze bridges it only when it is a
    // single isolated gap — the next day back must have real activity. That
    // keeps a freeze from inventing activity at the run's natural end and stops
    // a two-day gap (frozen day followed by another missing day) from bridging.
    if (frozenDays.has(key)) {
      const probe = new Date(cursor);
      probe.setUTCDate(probe.getUTCDate() - 1);
      if (days.has(utcDayKey(probe))) {
        streak++;
        cursor.setTime(probe.getTime());
        continue;
      }
    }
    break;
  }
  return streak;
}
