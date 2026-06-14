## Context

The daily quiz stores English content in the base `prompt`/`options` columns and optional per-locale content in a `translations` JSONB column shaped `{ "es": { prompt, options[] }, "fr": { prompt, options[] } }` (migration `20260613000000_quiz_translations.sql`). The read helper `localizeQuizQuestion` (`lib/quiz.ts`) serves the request locale and falls back to English on anything missing or malformed. The admin author flow validates the same shape. All of this is live; what is missing is the data: `supabase/seed/quiz.sql` inserts ~31 English-only questions, and deployed databases carry those same untranslated rows.

The seed uses `on conflict (active_on) do nothing`, so editing the seed alone will **not** update rows that already exist in a database — a real concern for production, which has already been seeded.

## Goals / Non-Goals

**Goals:**
- Supply accurate `es` and `fr` translations for every shipped question's prompt and options.
- Make fresh environments (`db reset`) seed already-translated questions.
- Backfill already-deployed databases without requiring a destructive reseed.
- Keep option order identical across locales so `correct_index` stays valid everywhere.
- Add an automated check that the seed content is translation-complete.

**Non-Goals:**
- No schema, RLS, view, helper, admin-action, or page changes — the infrastructure is done.
- No machine-translation pipeline or runtime translation service; translations are authored, static content.
- No change to the answer-omitting guarantee or grading function.
- Not translating future admin-authored questions automatically — admins still enter those via the existing form.

## Decisions

**Decision: Translate option *answer text*, carry proper nouns/numerals through as-is when that is the correct translation.**
Options fall into three buckets: (1) descriptive answers ("Every 4 years" → "Cada 4 años" / "Tous les 4 ans", "90 minutes" → "90 minutos" / "90 minutes") that must be localized; (2) country names that have locale forms ("Brazil" → "Brasil" / "Brésil", "England" → "Inglaterra" / "Angleterre", "Germany" → "Alemania" / "Allemagne"); (3) person names and bare numerals ("Diego Maradona", "3", "48") that are identical across locales. Every locale still supplies a full option array of the same length — even when entries are unchanged — because the validator rejects any block whose option count differs from English. Alternative considered: omit unchanged options. Rejected — the validator and the index-alignment contract both require a complete, equal-length array.

**Decision: Ship translations in BOTH the seed file and a backfill migration.**
The seed (`supabase/seed/quiz.sql`) gets a `translations` value inline so new/local environments are correct from `db reset`. A new migration `supabase/migrations/<ts>_quiz_question_translations_backfill.sql` issues `UPDATE public.quiz_questions SET translations = '<jsonb>' WHERE active_on = '<date>'` per question for databases already seeded. Alternative considered: migration only. Rejected — the seed is the source of truth for fresh setups and would drift. Alternative: seed only. Rejected — production is already seeded and `do nothing` would skip it.

**Decision: Key the backfill on `active_on`, not `id`.**
`id` is a random UUID generated at insert time and differs per environment; `active_on` is the stable, unique business key shared by seed and every deployment. The backfill matches rows by `active_on`, making it portable and idempotent (re-running rewrites the same JSON).

**Decision: Backfill is unconditional set, and idempotent by construction.**
Each `UPDATE` sets the full `translations` object for that `active_on`. Re-running produces identical JSON, so it is naturally idempotent; no guard needed. It only touches the seeded `active_on` dates, leaving any admin-authored question untouched.

**Decision: Enforce completeness with a test over the seed.**
A test parses the option/translation arrays for each seeded question and asserts both `es` and `fr` exist, are count-matched, and are non-blank — reusing the same predicate semantics as `isUsableTranslation`. This turns the new spec requirement into a guard that fails if a future question is added English-only.

## Risks / Trade-offs

- **Wrong option order in a translation mis-grades that locale** → Mitigation: the positional-alignment rule is explicit in the spec; the count-match validator already rejects length mismatches; the completeness test asserts equal length; reviewers verify each option lines up with its English counterpart.
- **Seed and migration JSON drift apart** → Mitigation: author the JSON once and use the identical literal in both files; the completeness test pins the seed, and a quick diff of the two payloads is part of the tasks.
- **Translation quality / accuracy** (especially football terminology and country names) → Mitigation: human review of `es` and `fr` against the English source before merge; proper nouns kept verbatim where appropriate.
- **Apostrophe escaping in SQL string literals** (e.g. French "l'Allemagne", "Every World Cup") → Mitigation: JSONB literals are single-quoted SQL strings; any embedded single quote must be doubled. Validate by applying the migration locally (`supabase db reset` / `psql -f`).
- **A future admin-authored question is added English-only** → Accepted: out of scope for the data backfill, but the completeness test covers the seeded set so the shipped baseline stays fully translated.

## Migration Plan

1. Author the `es`/`fr` JSON for all ~31 questions (prompt + aligned options).
2. Update `supabase/seed/quiz.sql` to include `translations` in each insert.
3. Add `supabase/migrations/<ts>_quiz_question_translations_backfill.sql` with one `UPDATE ... WHERE active_on = ...` per question (same JSON as the seed).
4. Add the completeness test; run the suite.
5. Apply locally (`supabase db reset` or `psql -f`) and spot-check `/es/quiz` and `/fr/quiz`.
6. Deploy: the migration runs against production and backfills existing rows. **Rollback**: translations are additive and English remains canonical, so reverting is a no-op for behavior; if needed, a follow-up migration can reset `translations` to `'{}'::jsonb` for those `active_on` dates.

## Open Questions

- None blocking. (If a future locale beyond `es`/`fr` is added to `SUPPORTED_LOCALES`, this backfill would need extending — but that is a separate change.)
