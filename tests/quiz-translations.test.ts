import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { localizeQuizQuestion } from "@/lib/quiz";
import {
  QUIZ_QUESTIONS,
  quizTranslations,
  quizTranslationsSqlLiteral,
  type QuizSeedQuestion,
} from "./fixtures/quiz-translations";

// Resolve repo files relative to THIS test, not the cwd, so it runs anywhere.
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const SEED_SQL = read("../supabase/seed/quiz.sql");
// The German backfill is a new, dated migration; the historical es/fr backfill
// (20260614020000) is already applied to remote and intentionally left as-is.
// The canonical {es, fr, de} literal is embedded in the newer file.
const MIGRATION_SQL = read(
  "../supabase/migrations/20260617000000_quiz_question_translations_de_backfill.sql",
);

const TRANSLATED: Array<"es" | "fr" | "de"> = ["es", "fr", "de"];

describe("quiz seed translations are complete", () => {
  it("ships ~30 questions", () => {
    // Sanity floor so an accidental truncation of the seed is caught.
    expect(QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(30);
  });

  it("every active_on is unique", () => {
    const dates = QUIZ_QUESTIONS.map((q) => q.activeOn);
    expect(new Set(dates).size).toBe(dates.length);
  });

  for (const q of QUIZ_QUESTIONS) {
    for (const locale of TRANSLATED) {
      // mirrors isUsableTranslation in lib/quiz.ts: non-blank prompt, one
      // non-blank option per English option, identical count.
      it(`${q.activeOn} has a complete ${locale} translation`, () => {
        const t = q[locale];
        expect(t.prompt.trim().length).toBeGreaterThan(0);
        expect(t.options).toHaveLength(q.options.length);
        for (const opt of t.options) {
          expect(opt.trim().length).toBeGreaterThan(0);
        }
        // correct_index must still point at a real option in every locale.
        expect(q.correctIndex).toBeLessThan(t.options.length);
      });
    }
  }
});

describe("localizeQuizQuestion serves the seeded translations", () => {
  // The helper is the real read path; assert it returns translated, non-English
  // content for every seeded question (prompts always differ between locales).
  for (const q of QUIZ_QUESTIONS) {
    const question = {
      prompt: q.prompt,
      options: q.options,
      translations: quizTranslations(q),
    };

    it(`serves es + fr for ${q.activeOn}`, () => {
      expect(localizeQuizQuestion(question, "en")).toEqual({
        prompt: q.prompt,
        options: q.options,
      });

      for (const locale of TRANSLATED) {
        const localized = localizeQuizQuestion(question, locale);
        expect(localized).toEqual({
          prompt: q[locale].prompt,
          options: q[locale].options,
        });
        // Not a silent English fallback.
        expect(localized.prompt).not.toBe(q.prompt);
      }
    });
  }
});

describe("SQL files match the canonical fixture (no drift)", () => {
  it("seed contains one value row per question", () => {
    const rows = SEED_SQL.match(/^\s*\('/gm) ?? [];
    expect(rows).toHaveLength(QUIZ_QUESTIONS.length);
  });

  it("migration contains one UPDATE per question", () => {
    const updates = MIGRATION_SQL.match(/^update public\.quiz_questions set/gm) ?? [];
    expect(updates).toHaveLength(QUIZ_QUESTIONS.length);
  });

  for (const q of QUIZ_QUESTIONS) {
    it(`seed + migration embed ${q.activeOn}'s translations verbatim`, () => {
      const literal = quizTranslationsSqlLiteral(q);
      expect(SEED_SQL).toContain(literal);
      expect(SEED_SQL).toContain(`'${q.activeOn}'`);
      expect(MIGRATION_SQL).toContain(literal);
      expect(MIGRATION_SQL).toContain(`where active_on = '${q.activeOn}'`);
    });
  }
});

// Type-only guard: keep the fixture row shape honest.
const _typecheck: QuizSeedQuestion = QUIZ_QUESTIONS[0];
void _typecheck;
