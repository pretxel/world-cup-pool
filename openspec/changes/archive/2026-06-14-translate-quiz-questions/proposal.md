## Why

The daily quiz already supports per-locale content: a `translations` JSONB column, a public view that exposes it, an admin author flow, and a read helper that serves the request locale with English fallback. But none of the ~31 shipped questions actually carry Spanish or French translations, so every `es`/`fr` visitor sees the quiz entirely in English. The localization machinery is built and unused — this change supplies the missing content so the feature works end to end.

## What Changes

- Add Spanish (`es`) and French (`fr`) translations for **every** seeded quiz question (prompt + all options), populating the existing `translations` column.
- Update `supabase/seed/quiz.sql` so a fresh `db reset` (local / new environments) seeds questions already translated.
- Add an idempotent backfill migration that sets `translations` on existing rows by `active_on`, so already-deployed databases (production) get the content without a reseed.
- Keep option order identical across locales so the stored `correct_index` grades every locale the same — translations only re-word, never reorder. Numeric-only options (e.g. `'3'`,`'4'`) and proper nouns are carried through unchanged where that is the correct translation, but each locale still supplies a full, count-matching option array so the validator accepts it.
- Add a test asserting every seeded question has complete, count-matching `es` and `fr` translations (no silent English fallback for a supported locale).

No code paths, schema, RLS, or APIs change — the read helper, public view, admin validation, and grading function are already in place. This is a content/data change against existing infrastructure.

## Capabilities

### New Capabilities

_None._ The localization capability for the quiz already exists (`daily-quiz` spec: "Quiz content is served in the request locale with English fallback").

### Modified Capabilities

- `daily-quiz`: Adds a content-completeness requirement — every seeded/shipped quiz question SHALL carry complete `es` and `fr` translations, so a supported-locale visitor never falls back to English purely because content is missing. The existing fallback, no-answer-leak, and index-alignment guarantees are unchanged; this only strengthens the data contract.

## Impact

- **Data / migrations**: new backfill migration under `supabase/migrations/`; updated `supabase/seed/quiz.sql`.
- **Tests**: `tests/quiz.test.ts` (or a new content test) gains a completeness check over the seed data.
- **No code changes**: `lib/quiz.ts`, the public view, admin actions, and the `/quiz` page are untouched.
- **Risk**: incorrect option order in a translation would mis-grade that locale; mitigated by the positional-alignment constraint and the count-match validator that already rejects malformed blocks.
