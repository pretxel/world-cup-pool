## 1. Register the German locale

- [x] 1.1 In `lib/i18n.ts`: add `"de"` to `SUPPORTED_LOCALES`, add `de: "Deutsch"` to `LOCALE_LABELS`, and add `de: "de"` to `LOCALE_FLAG_SLUG`
- [x] 1.2 Confirm `public/flags/de.svg` exists and matches the dimensions/format of the other flag assets (it is already present — verify, do not recreate)
- [x] 1.3 Verify the locale-generic consumers need no edits (middleware, `i18n.ts` request config, `app/sitemap.ts`, `components/language-switcher.tsx`, OG routes) — they read `SUPPORTED_LOCALES`/the maps dynamically; spot-check `/de/` resolves after the catalog exists

## 2. German message catalog

- [x] 2.1 Create `messages/de.json` by mirroring `messages/en.json`'s exact structure (all 30 namespaces / 669 keys) with every value translated to German; preserve every `{placeholder}`, ICU block (`{count, plural, …}`), and `<tag></tag>` verbatim; leave brand tokens untranslated where `es`/`fr` leave them; save UTF-8
- [x] 2.2 Add two new keys to ALL four catalogs (`en`, `es`, `fr`, `de`) in the `quiz` namespace: `langDe` (locale label, e.g. "German"/"Alemán"/"Allemand"/"Deutsch") and `badgeDe` (the German "translated" badge), matching the existing `langEs`/`langFr` and `badgeEs`/`badgeFr` patterns so key parity holds
- [x] 2.3 Sanity-check parity locally: the flattened key set of `de.json` equals `en.json` (no missing/extra keys) and every placeholder present in an `en` value is present in the matching `de` value

## 3. SEO / OpenGraph metadata

- [x] 3.1 In `app/[locale]/layout.tsx`: add `de: "de_DE"` to `OG_LOCALE`, add `de: ["en_US", "es_ES", "fr_FR"]` to `ALT_LOCALES`, and add `de_DE` to the alternate arrays of `en`/`es`/`fr` so each advertises German
- [x] 3.2 In `app/layout.tsx`: add `de_DE` to the root `alternateLocale` array (currently `["es_ES", "fr_FR"]`)

## 4. German quiz content (generator + data)

- [x] 4.1 In `scripts/gen-quiz-translations.mjs`: add `de: Localized` to the `Question` typedef and add a complete, order-aligned German translation (`prompt` + one option per English option, same order) to each of the 33 questions
- [x] 4.2 Determine whether the existing `20260614020000_quiz_question_translations_backfill.sql` migration is already applied to remote. If applied: make the generator emit a NEW, dated, idempotent German backfill migration that sets the full `{es, fr, de}` translations object per `active_on` (leave the historical migration untouched). If still local-only/unapplied: regenerate it in place with `de` included
- [x] 4.3 Run `node scripts/gen-quiz-translations.mjs` to regenerate `supabase/seed/quiz.sql`, the backfill migration (per 4.2), and `tests/fixtures/quiz-translations.ts`; confirm the generated fixture type now carries `de` and every question has a `de` block
- [x] 4.4 Confirm option order is never reordered across locales (the `correct_index` must grade `de` identically) and that each German translation passes the existing translation validator (non-blank prompt + one non-blank option per English option)

## 5. Admin quiz form

- [x] 5.1 In `app/[locale]/(admin)/admin/quiz/page.tsx`: add `{ code: "de", langKey: "langDe" }` to `TRANSLATION_LOCALES` so the form renders a German translation fieldset
- [x] 5.2 Replace the hardcoded badge ternary `t(code === "es" ? "badgeEs" : "badgeFr")` with a locale-driven lookup (e.g. `badge${capitalize(code)}` → `badgeEs`/`badgeFr`/`badgeDe`), fixing the latent bug where any non-`es` code rendered the French badge

## 6. Tests

- [x] 6.1 `tests/quiz-translations.test.ts`: extend `TRANSLATED` from `["es", "fr"]` to `["es", "fr", "de"]` (and widen its type union) so the seeded/fixture German coverage is asserted
- [x] 6.2 Confirm `tests/i18n.test.ts` now exercises `de` automatically (parity + label + file-exists) — no edit expected; if any locale-count assumption is hardcoded, update it
- [x] 6.3 (If the German backfill is a new migration) add/extend coverage or a manual check that the backfill is idempotent and adds `de` without disturbing `es`/`fr`

## 7. Verification

- [x] 7.1 Run `npm run lint`, `npm run typecheck`, and `npm run test`; confirm green (esp. `i18n` parity and `quiz-translations` suites)
- [x] 7.2 Build/smoke-check that `/de`, `/de/matches`, `/de/quiz`, and the language switcher render German and that `/de` metadata emits `og:locale=de_DE` with the other three as alternates
- [x] 7.3 Validate the change: `openspec validate add-german-locale --strict`
