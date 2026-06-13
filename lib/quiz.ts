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
 * @param answeredAt ISO timestamps of the user's answers (any order, any tz).
 * @param now reference instant (injectable for tests).
 */
export function computeStreak(answeredAt: string[], now: Date = new Date()): number {
  const days = new Set(answeredAt.map((iso) => utcDayKey(new Date(iso))));
  if (days.size === 0) return 0;

  // Anchor at today (UTC midnight). If today has no answer, the streak can
  // still be alive from yesterday backwards; otherwise it's zero.
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (!days.has(utcDayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(utcDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(utcDayKey(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
