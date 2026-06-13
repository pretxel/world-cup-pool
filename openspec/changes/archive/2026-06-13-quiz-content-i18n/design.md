# Design: quiz-content-i18n

## Context

Quiz content lives in `public.quiz_questions (prompt text, options text[], correct_index smallint, active_on date)`. Readers consume `v_quiz_questions_public` (security-invoker-off view: `id, prompt, options, active_on`) so `correct_index` never reaches the client before answering; grading happens server-side in the `answer_quiz(uuid, smallint)` RPC by index. Admin authoring is a server-action form (`app/[locale]/(admin)/admin/quiz/actions.ts`) with zod validation (2–4 non-blank options, `correct_index` within range). Locales are fixed: `SUPPORTED_LOCALES = ["en", "es", "fr"]` (`lib/i18n.ts`), default `en`.

Constraints: RLS model must stay intact (base table admin-only, public reads via the view); the answer flow and quiz leaderboard must not change; untranslated questions must keep working.

## Goals / Non-Goals

**Goals:**
- Serve quiz prompt/options in the request locale (ES/FR) when a translation exists; English otherwise.
- Let admins author optional ES/FR translations next to the English question.
- Keep grading locale-independent.

**Non-Goals:**
- Machine/auto-translation of questions.
- Translating historical answers or leaderboard data (none of it is language-bearing).
- Per-locale `active_on` scheduling or per-locale correct answers.
- UI-chrome i18n (owned by the `i18n-en-es-fr` change).

## Decisions

### D1: Translations as a JSONB column on quiz_questions, English stays canonical

```sql
alter table public.quiz_questions
  add column translations jsonb not null default '{}'::jsonb;
-- shape: { "es": { "prompt": text, "options": text[] }, "fr": { ... } }
```

- English remains in the existing `prompt`/`options` columns — every existing row and code path is valid unchanged, and the fallback is "just read the base columns".
- One JSONB column vs four typed columns (`prompt_es`, `options_es`, …): JSONB keeps the row narrow, adds locales without DDL, and the app validates shape at the only write path (admin action). Vs a `quiz_question_translations` child table: normalization buys nothing for a 2-locale, single-writer, read-through-view feature and costs a join in the public view.
- `v_quiz_questions_public` adds `translations` to its select list. It contains only prompt/options text — no `correct_index` — so the no-answer-leak property holds.

### D2: Locale resolution in the page, shared pure helper

A small pure helper (e.g. `localizeQuizQuestion(row, locale)` in `lib/quiz.ts`, next to `computeStreak`) returns `{ prompt, options }`:

- `locale === "en"` or no `translations[locale]` → base columns.
- Translation exists but its `options` length ≠ base `options` length, or any entry blank → **full English fallback** (mixed-language half-questions and index drift are both worse than English).
- Option order is positional: translation `options[i]` must correspond to base `options[i]`, so `correct_index` grades every locale identically. The helper never reorders.

Pure function → unit-testable without Supabase, same pattern as `computeStreak`.

### D3: Admin authoring — optional per-locale fieldsets, validated against the English shape

The authoring form gains collapsed/secondary "Español" and "Français" fieldsets: one prompt input + the same number of option slots as English. Server action zod rules:

- A locale's translation is saved only if its prompt is non-blank; blank translation blocks are dropped (not errors).
- If saved, every option slot matching a non-blank English slot must be non-blank, and counts must match after the same blank-filtering applied to English options — preserving index alignment.
- Edits re-validate the whole shape (English edit that changes option count invalidates stored translations → the action requires re-supplying or clearing them; clearing is the default form state).

### D4: Types and the database.types.ts contract

`quiz_questions.translations` arrives as `Json` in generated types. Define `QuizTranslations` in `lib/quiz.ts` and narrow at the single read site (the page) and single write site (the admin action) — no `as` casts scattered around. Regenerate `lib/database.types.ts` from the migration.

## Risks / Trade-offs

- [JSONB has no DB-level shape guarantee] → single write path (admin action) validates with zod; the read helper defensively falls back to English on any malformed shape, so bad data degrades to today's behavior.
- [English edit can orphan translations (option count changes)] → D3 forces re-supply/clear on edit; the read helper's count check catches any row that slips through.
- [Partially translated catalog looks inconsistent (some days ES, some EN)] → accepted; fallback-to-English is the standard pattern across the app and better than blocking publication on full translation.
- [View now exposes translations to anon] → it is the same public content in other languages; `correct_index` remains excluded.

## Migration Plan

1. Migration `add column translations` + `create or replace view v_quiz_questions_public` (additive; old clients unaffected).
2. Regenerate types, land helper + page + admin form behind the same deploy.
3. Rollback = revert deploy; column can stay (additive, defaulted) without harm.

## Open Questions

- Q1: Should the admin form surface which days lack translations (small "untranslated" badge in the question list)? Cheap, helps the author; default: yes if trivial during implementation, otherwise skip.
