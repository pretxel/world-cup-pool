# Proposal: quiz-content-i18n

## Why

The app ships in EN/ES/FR (active `i18n-en-es-fr` change covers UI chrome), but daily-quiz *content* — the question prompt and answer options — lives in `public.quiz_questions` as single-language English text. A Spanish or French visitor gets a fully translated page frame around an English question, which undercuts the point of the daily quiz as a casual-engagement feature.

## What Changes

- Store optional ES/FR translations of each quiz question's `prompt` and `options` alongside the English originals (English remains the canonical content and the fallback).
- The public quiz page serves the prompt and options in the request locale when a translation exists, falling back to English otherwise. Answer order is identical across locales so `correct_index` grading is locale-independent.
- The admin quiz authoring form gains optional ES/FR fields for prompt and options, validated so a provided translation has exactly as many options as the English original.
- Grading, streaks, points, and the quiz leaderboard are untouched — answers are by index, not text.

No breaking changes: untranslated questions keep working everywhere in English.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `daily-quiz`: question delivery becomes locale-aware (translated prompt/options with EN fallback); admin authoring gains optional per-locale translation fields with option-count validation.

## Impact

- **DB**: one migration on `public.quiz_questions` (translations storage) + updated `v_quiz_questions_public` view to expose it. `answer_quiz` RPC unchanged.
- **Code**: `app/[locale]/(public)/quiz/page.tsx` (locale pick + fallback), `app/[locale]/(admin)/admin/quiz/{page.tsx,actions.ts}` (authoring fields + validation), `lib/db.ts` / `lib/database.types.ts` types.
- **i18n catalogs**: a few new `admin` keys for the translation field labels (EN/ES/FR).
- **Tests**: locale-pick/fallback helper tests, admin validation tests.
