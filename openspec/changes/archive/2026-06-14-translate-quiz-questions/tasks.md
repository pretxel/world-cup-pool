## 1. Author translations

- [x] 1.1 Compile the full list of ~31 seeded questions from `supabase/seed/quiz.sql` (prompt, options, `active_on`) as the English source of truth.
- [x] 1.2 Write the Spanish (`es`) prompt and aligned option array for each question — translate descriptive answers ("Every 4 years" → "Cada 4 años"), localize country names ("Brazil" → "Brasil"), and carry person names / bare numerals through verbatim. Keep option order and count identical to English.
- [x] 1.3 Write the French (`fr`) prompt and aligned option array for each question under the same rules ("Every 4 years" → "Tous les 4 ans", "Germany" → "Allemagne").
- [x] 1.4 Review every translation for index alignment: `options[i]` (es/fr) must mean the same answer as English `options[i]`, so `correct_index` grades identically.
- [x] 1.5 Verify SQL-literal safety: double every single quote inside the JSON strings (e.g. French "l'Angleterre" → "l''Angleterre").

> All 31 questions authored as one canonical source in `scripts/gen-quiz-translations.mjs`, which generates the seed, migration, and test fixture so the three never drift. SQL-quote doubling is done by the generator's `sqlStr` (`men''s`, `l''histoire`, `d''or`, etc., all verified in output).

## 2. Seed file

- [x] 2.1 Update `supabase/seed/quiz.sql` so each insert includes a `translations` JSONB value of shape `{ "es": { prompt, options[] }, "fr": { prompt, options[] } }`.
- [x] 2.2 Confirm the seed remains idempotent (`on conflict (active_on) do nothing`) and the column list / value count still align.

## 3. Backfill migration

- [x] 3.1 Create `supabase/migrations/20260614020000_quiz_question_translations_backfill.sql` (bumped past a same-day `..010000_quiz_reminder_email` migration from another change to avoid a duplicate version).
- [x] 3.2 For each question, add `UPDATE public.quiz_questions SET translations = '<jsonb>'::jsonb WHERE active_on = '<date>';` using the **same** JSON authored for the seed.
- [x] 3.3 Confirm idempotency by construction (re-running sets identical JSON) and that only seeded `active_on` dates are touched (admin-authored questions untouched).
- [x] 3.4 Diff the migration payloads against the seed payloads to ensure they match exactly (no drift). — `tests/quiz-translations.test.ts` asserts both files embed the identical `'{...}'::jsonb` literal per question.

## 4. Completeness test

- [x] 4.1 Add a test (`tests/quiz-translations.test.ts`) that loads the seeded questions and asserts each has both `es` and `fr` translations.
- [x] 4.2 Assert for every question + locale: prompt non-blank, option array length equals English option count, every option non-blank (mirroring `isUsableTranslation`).
- [x] 4.3 Assert `localizeQuizQuestion` returns translated (non-English) prompt/options for every seeded question in `es` and `fr`.

## 5. Verify

- [~] 5.1 Apply locally and run the migration; confirm no SQL errors. — No local Supabase stack / `DATABASE_URL` available in this environment. Validated statically instead: every embedded JSONB literal (31 in the seed + 31 in the migration) parses as valid JSON with the `{es,fr}` shape, and quote-escaping is correct. Still needs one run against a live Postgres before deploy.
- [x] 5.2 Run the test suite (`vitest`) and confirm the completeness test passes. — full suite 398 passed; typecheck + lint clean.
- [ ] 5.3 Load `/es/quiz` and `/fr/quiz` for a day with a seeded question; confirm prompt and options render in the locale and answering still grades correctly. — Requires a running DB + dev server (not available here). The read path itself is exercised by the `localizeQuizQuestion` assertions in 4.3.
