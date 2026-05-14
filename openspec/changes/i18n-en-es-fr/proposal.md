## Why

The pool serves players in markets where English isn't always the comfortable default — Mexico, the Spanish-speaking US population, French-speaking Canada (and France-aligned WC viewers). Today every label, button, and metadata string is English-only. Adding Spanish and French opens the product to those audiences without forcing them through a translation layer, and sets up the routing/typography foundations for future locales.

Scope is explicitly **three** locales: **English (en, default), Spanish (es), French (fr)**. No others.

## What Changes

- **BREAKING (routing):** every URL gains a locale prefix: `/`, `/matches`, `/matches/:id`, `/leaderboard`, `/my-picks`, `/admin/matches`, `/sign-in`, `/onboarding`, `/how-it-works` all move under `/[locale]/...`. Bare paths (no prefix) are redirected by middleware to the chosen locale (cookie → Accept-Language → `en` fallback).
- `app/[locale]/` segment introduced. All current `app/(public)`, `app/(app)`, `app/(admin)`, `app/(auth)` route groups and the top-level pages (`/`, `/how-it-works`, `/onboarding`) move under it. `app/layout.tsx` and `app/not-found.tsx` stay (they are locale-agnostic shells).
- `next-intl` (v4) added as the i18n engine — Server-Component-native, ICU MessageFormat, type-safe message keys.
- Translation messages live under `messages/{en,es,fr}.json`. English is the source-of-truth; Spanish and French are translated copies.
- Locale detection: a chained strategy in middleware — `NEXT_LOCALE` cookie → `Accept-Language` header → `en`. The chosen locale is persisted to `NEXT_LOCALE` cookie on every response.
- Language switcher component lands in the global header. Switching writes the cookie and replaces the locale segment in the current URL.
- All static UI copy, page metadata (titles, descriptions, OG tags), error/empty-state messages, status badges, and admin labels are translated.
- Date and time formatting in `<LocalTime />` and elsewhere uses the active locale via `Intl.DateTimeFormat`. Number formatting (scores, totals) uses `Intl.NumberFormat` where it matters.
- The XML sitemap emits one URL per locale per route, with `alternates` linking the three locales.
- Server actions and auth `redirect()` calls produce locale-aware paths.

## Capabilities

### New Capabilities
- `i18n`: rules governing locale routing, detection, persistence, formatting, and the language switcher.

### Modified Capabilities
- `leaderboard`: standing copy + metadata now driven by translations; the page itself still uses `v_leaderboard_overall` unchanged.
- `match-presentation`: header/badge/label copy now translated; flag/stage/venue rendering unchanged.
- `match-results`: admin form labels translated; behavior unchanged.
- `predictions-lock`: server-action error strings translated per locale; lock semantics unchanged.

## Impact

- Code: heavy restructure under `app/[locale]/`; every `page.tsx`, route layout, and any component with hardcoded English copy. New `i18n.ts`, `messages/*.json`, `lib/i18n.ts`, `components/language-switcher.tsx`. `middleware.ts` extended to chain `next-intl` middleware in front of the existing Supabase auth refresh.
- Deps: `next-intl` (single new runtime dep).
- SEO: per-locale canonical URLs; `alternates` per route; `lang` attribute on `<html>` reflects active locale.
- Sitemap: 3× current entries (one per locale).
- Tests: new tests for the locale-detect helper (cookie → header → fallback) and that translated message bundles share identical key sets across `en`, `es`, `fr`.
- No DB changes. No data migration. Existing user predictions/profiles unaffected.
- Stale bookmarks for bare `/matches`-style URLs continue to work (redirect to localized version).
