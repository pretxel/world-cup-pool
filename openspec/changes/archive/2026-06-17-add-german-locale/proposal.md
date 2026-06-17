## Why

The platform ships in English, Spanish, and French. German (`de`) is a large
football audience with no current support — a `/de/*` route 404s, the language
switcher offers no German, and quiz content has no German translation. Adding
German extends the existing, fully locale-generic i18n architecture to a fourth
locale so German visitors get the whole product — UI, SEO/discovery, and quiz
content — in their language.

## What Changes

- **Register `de` as a supported locale.** Add `de` to the single source of
  truth (`SUPPORTED_LOCALES`) plus its display label ("Deutsch") and flag slug.
  Middleware, the message loader, the sitemap, OG images, and the language
  switcher already read this list dynamically, so `/de/*` routing, locale
  detection, hreflang, and the switcher option light up with no further wiring.
- **Add the German message catalog.** New `messages/de.json` mirroring the
  English catalog exactly (all 30 namespaces / 669 keys), every value translated
  to German with all ICU plurals, `{placeholders}`, and `<tags>` preserved. This
  is what keeps the existing key-parity test green and every UI surface localized.
- **Advertise `de` in SEO metadata.** Add the German entries to the OG locale
  and alternate-locale maps so `/de` pages emit correct `og:locale` / hreflang
  and German is listed as an alternate on the other locales.
- **Translate quiz content into German.** Teach the canonical quiz generator
  (`scripts/gen-quiz-translations.mjs`) about `de`, add German translations for
  all seeded questions, and regenerate the seed + test fixture; ship a German
  backfill for already-deployed rows (append-only — historical migrations stay
  untouched). Extend the admin quiz form to capture German translations and fix
  its locale-hardcoded badge so it is locale-driven rather than an es/fr ternary.
- **Out of scope:** transactional emails stay in `DEFAULT_LOCALE` (English) for
  all locales — German is not singled out; es/fr behave identically today, so
  per-user email localization is a separate change (would need a profile locale).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `i18n`: the supported-locale set becomes exactly `en, es, fr, de` (was three);
  the language switcher, the "translated content covers all surfaces" parity
  requirement, and the sitemap alternates requirement all extend from three
  locales to four. Locale routing, detection, formatting, and `html lang` are
  already generic and gain `de` without requirement changes.
- `daily-quiz`: admin question creation accepts an optional German translation
  (alongside Spanish/French); quiz content is served in `de` when present (same
  English-fallback rules); and every seeded/backfilled question SHALL ship a
  complete German translation in addition to Spanish and French.

## Impact

- **Registry/SEO:** `lib/i18n.ts` (locale set, label, flag slug),
  `app/[locale]/layout.tsx` (`OG_LOCALE`, `ALT_LOCALES`), `app/layout.tsx`
  (root `alternateLocale`).
- **Catalog:** new `messages/de.json` (~669 keys, incl. new `quiz.langDe` /
  `quiz.badgeDe`). `public/flags/de.svg` already exists.
- **Quiz content:** `scripts/gen-quiz-translations.mjs` (de in typedef +
  per-question German), regenerated `supabase/seed/quiz.sql` and
  `tests/fixtures/quiz-translations.ts`, plus a new append-only German backfill
  migration for existing deployments; `app/[locale]/(admin)/admin/quiz/page.tsx`
  (German translation field + locale-driven badge).
- **Tests:** `tests/i18n.test.ts` and `tests/quiz-translations.test.ts` extend to
  assert German parity/coverage (the former automatically once `de` is registered).
- **No change:** middleware, `i18n.ts` request config, sitemap, OG routes, and the
  switcher component — all already locale-generic.
