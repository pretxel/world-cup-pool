## Context

The i18n stack is deliberately locale-generic. A single module `lib/i18n.ts`
exports `SUPPORTED_LOCALES` (`["en","es","fr"]`), and middleware, the next-intl
request config (`i18n.ts`), the sitemap, the OG image routes, and the language
switcher all read it dynamically — adding a locale there is enough for routing,
detection, hreflang, the switcher option, and message loading to work. A mapping
of the i18n surface confirmed only a handful of places hardcode the locale set:

- `lib/i18n.ts` — `SUPPORTED_LOCALES`, `LOCALE_LABELS`, `LOCALE_FLAG_SLUG`.
- `app/[locale]/layout.tsx` — `OG_LOCALE` and `ALT_LOCALES` (`Record<Locale, …>`,
  so a missing `de` is a compile error — good).
- `app/layout.tsx` — root `alternateLocale: ["es_ES","fr_FR"]` (advertises the
  non-default locales as OG alternates on static routes).
- The message catalogs `messages/{en,es,fr}.json` — exact key parity is enforced
  by `tests/i18n.test.ts`; a `de.json` with any missing/extra key fails the suite.

Quiz content is separate from the UI catalog. Quiz questions live in the DB with
a `translations` JSONB column (`{es, fr}`). The canonical source is
`scripts/gen-quiz-translations.mjs`, which emits three files: the fresh-install
seed (`supabase/seed/quiz.sql`), a backfill migration for already-deployed rows,
and the test fixture (`tests/fixtures/quiz-translations.ts`). The admin quiz form
(`app/[locale]/(admin)/admin/quiz/page.tsx`) hardcodes `TRANSLATION_LOCALES` to
`es`/`fr` and renders the "translated" badge with an `es ? badgeEs : badgeFr`
ternary — both must become locale-driven to admit German.

The flag asset `public/flags/de.svg` already exists.

## Goals / Non-Goals

**Goals:**
- `/de/*` routes resolve, statically generate, and render fully in German.
- German is detectable (Accept-Language / cookie), switchable, and advertised in
  hreflang / OG alternates exactly as `es`/`fr` are.
- `messages/de.json` is at 100% key parity with `en.json`, placeholders/ICU/tags
  intact, so no surface falls back to English and the parity test passes.
- Every shipped quiz question carries a complete German translation; German quiz
  visitors see German content, and the admin can author German translations.

**Non-Goals:**
- Localizing transactional emails (reminders/result/magic-link). They send in
  `DEFAULT_LOCALE` for every locale today; changing that needs per-user locale
  tracking and is a separate change.
- Region variants (`de-AT`, `de-CH`), per-locale webmanifest, or RTL work.
- Re-architecting the quiz generator beyond what `de` requires.

## Decisions

### Decision: English is the structural source of truth for `de.json`
Build `messages/de.json` by copying `en.json`'s structure and translating values,
because `en.json` is canonical and the parity test compares every locale's flat
key set to it. Preserve verbatim: every `{placeholder}`, every ICU block
(`{count, plural, …}`), and every `<tag></tag>`. Brand tokens left untranslated
by `es`/`fr` (e.g. "Pool", "WC26 Pool") stay untranslated in `de` for
consistency. Two new keys are added to **all** catalogs, not just `de`:
`quiz.langDe` (switcher/form label "Deutsch") and `quiz.badgeDe` (the German
"translated" badge) — adding keys requires updating en/es/fr too or the parity
test fails.

### Decision: Locale values for German
`LOCALE_LABELS.de = "Deutsch"`, `LOCALE_FLAG_SLUG.de = "de"` (asset exists),
`OG_LOCALE.de = "de_DE"`, `ALT_LOCALES.de = ["en_US","es_ES","fr_FR"]`, and `de`
appended to the other three `ALT_LOCALES` arrays and to the root
`alternateLocale`. `de_DE` is the standard BCP-47/OG form; no region-specific
variant is introduced.

### Decision: Quiz generator learns `de`; backfill is append-only
Add `de: Localized` to the generator's `Question` typedef and a German
translation to each of the 33 questions, then regenerate the seed and the test
fixture in place. For already-deployed databases, do **not** rewrite the existing
historical backfill migration (`20260614020000_…`, already applied) — that breaks
migration immutability and would not re-run anyway. Instead the generator emits a
**new, dated** German backfill migration whose `UPDATE`s set the full
`{es, fr, de}` translations object keyed by `active_on`, idempotently, so it is
safe to apply once to existing rows. (If verification shows the 06-14 migration
is still local-only and unapplied, collapse this into regenerating it in place —
tasks call this out.) Option order is never reordered across locales, so the
stored `correct_index` grades German identically — the same invariant `es`/`fr`
already satisfy.

### Decision: Admin quiz form becomes locale-driven, not es/fr-hardcoded
Add `{ code: "de", langKey: "langDe" }` to `TRANSLATION_LOCALES` and replace the
`es ? "badgeEs" : "badgeFr"` ternary with a per-locale badge-key lookup
(`badge<Code>`), so the form renders a German fieldset and the correct German
badge. This also removes the latent bug where any non-`es` code rendered the
French badge.

### Decision: Lean on existing tests; extend only where they enumerate locales
`tests/i18n.test.ts` is already locale-generic — it asserts `de` parity and
label automatically once `de` is registered and `de.json` exists. Only
`tests/quiz-translations.test.ts` hardcodes the translated set
(`["es","fr"]`) and must gain `"de"` (and the fixture type must gain `de`).

## Risks / Trade-offs

- **[Catalog parity drift]** A single missing/extra/renamed key in `de.json`
  fails `i18n.test.ts` and silently falls back elsewhere → build `de.json` from
  `en.json`'s exact shape and run the parity test as the gate.
- **[ICU/placeholder corruption]** German grammar differs (plural forms, umlauts);
  a mangled `{…}` or plural block breaks rendering → preserve all interpolation
  syntax exactly, only translate human text, save UTF-8.
- **[Editing an applied migration]** Rewriting the 06-14 backfill would violate
  immutability and miss prod rows → emit a new dated, idempotent de-backfill
  instead; keep history append-only.
- **[Quiz translation quality]** 33 questions need accurate German that keeps
  option/index alignment → translate option-by-option in order, validate via the
  existing translation validator (option count + non-blank) and the seeded-parity
  test.
- **[Static generation cost]** Adds a fourth full locale tree to the build; this
  is linear and expected, not a regression.

## Migration Plan

Code + content change plus one new, append-only DB migration (German quiz
backfill) that stays local until explicitly pushed. Fresh installs get German via
the regenerated seed. Rollback is a revert of the code/catalog/generated files;
the backfill migration is additive and idempotent (no destructive down needed).
No change to default behavior for existing en/es/fr users.

## Open Questions

- None blocking. Region variant (`de-DE` vs `de-AT/CH`) is decided as `de_DE`;
  email localization is explicitly out of scope.
