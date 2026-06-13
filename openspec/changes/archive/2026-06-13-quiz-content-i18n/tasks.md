# Tasks: quiz-content-i18n

## 1. Schema & types

- [x] 1.1 Migration: `alter table public.quiz_questions add column translations jsonb not null default '{}'::jsonb`; `create or replace view public.v_quiz_questions_public` adding `translations` to the select list (still excluding `correct_index`)
- [x] 1.2 Regenerate `lib/database.types.ts`; confirm `v_quiz_questions_public` row type carries `translations: Json`
- [x] 1.3 Define `QuizTranslations` type + `localizeQuizQuestion(row, locale)` helper in `lib/quiz.ts`: en → base columns; missing/malformed/blank/count-mismatched translation → full English fallback; never reorders options

## 2. Public quiz page

- [x] 2.1 `app/[locale]/(public)/quiz/page.tsx`: pass the request locale through `localizeQuizQuestion` for prompt/options rendering (answer flow untouched — grading stays by index)
- [x] 2.2 Tests for `localizeQuizQuestion`: es/fr translation served; en always base; missing translation → EN; count mismatch → full EN; blank entry → full EN; malformed JSONB shape → full EN

## 3. Admin authoring

- [x] 3.1 `app/[locale]/(admin)/admin/quiz/actions.ts`: extend zod schema with optional `es`/`fr` translation blocks (prompt + option slots); blank block dropped; non-blank block requires non-blank prompt and exactly one non-blank option per English option; store under `translations`
- [x] 3.2 `app/[locale]/(admin)/admin/quiz/page.tsx`: add Español/Français fieldsets (prompt + option inputs mirroring the English slots); if trivial, badge untranslated questions in the list (design Q1)
- [x] 3.3 i18n: new `admin` keys for translation field labels/badge in `messages/{en,es,fr}.json`
- [x] 3.4 Tests for the action: translations stored when valid; blank block ignored; mismatched option count rejected; English-only submission unchanged

## 4. Verification

- [x] 4.1 Full suite + typecheck + lint green; apply migration to local/branch DB and load `/es/quiz`, `/fr/quiz` with a translated and an untranslated question
- [x] 4.2 Confirm public view still omits `correct_index` (no-answer-leak property) after the view change
