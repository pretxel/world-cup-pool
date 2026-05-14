## Context

Current shape:
- Next.js 16 App Router. `AGENTS.md` calls out that this is not the Next.js most LLMs were trained on — check `node_modules/next/dist/docs/` before relying on memorized APIs.
- Single existing middleware (`middleware.ts`) wraps `supabase.auth.getUser()` to refresh sessions on every navigation. Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `api/health`.
- Routes today: `app/page.tsx`, `app/how-it-works/`, `app/onboarding/`, `app/(public)/{matches,leaderboard}/...`, `app/(app)/my-picks/`, `app/(admin)/admin/matches/`, `app/(auth)/sign-in/`. Plus `app/layout.tsx`, `app/error.tsx`, `app/not-found.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`.
- All strings are inline English. No existing translation infrastructure.
- The shared root `app/layout.tsx` hardcodes `<html lang="en">`.

## Goals / Non-Goals

**Goals:**
- Three locales: `en` (default), `es`, `fr`. No more, no less. The list lives in one place and is the source of truth across middleware, sitemap, message loaders, and switcher.
- URLs prefix the locale: `/en/...`, `/es/...`, `/fr/...`. Bare `/...` paths redirect to the resolved locale.
- Locale persists across navigations via the `NEXT_LOCALE` cookie. First visit is decided by `Accept-Language`, with `en` as fallback.
- Server Components stay the default. Client components are added only where interactive (language switcher).
- Type-safe message keys via `next-intl`'s generated types from `messages/en.json`.
- Existing tests stay green. New tests cover locale detection + message-bundle key parity.

**Non-Goals:**
- Don't translate dynamic data: team names, venues, admin display names. These are user-/seed-controlled English strings.
- Don't translate Supabase Auth emails or email templates. (Out of scope; that's a Supabase Auth setting.)
- Don't add RTL support (no Arabic/Hebrew planned).
- Don't internationalize URLs themselves (paths remain `matches`, `leaderboard`, `my-picks` regardless of locale — localizing slugs would explode the link surface and break shareability).
- Don't add a fourth locale "just in case." Wide-open scope creep.
- No DB column for "preferred locale" on profiles. Cookie is the single source of truth; profile-level persistence can come later if asked.

## Decisions

**1. `next-intl` v4 (App Router-native), not DIY dictionaries.**

Reasons:
- First-class Server Component support (`getTranslations` from `next-intl/server`) means we don't have to mark whole pages as `"use client"` to translate them.
- ICU MessageFormat handles plurals (`{count, plural, one {…} other {…}}`) and gender out of the box — we'd build this badly by hand.
- Type-safe message keys via `messages/en.json` → generated `IntlMessages` interface. Catches missing/typo'd keys at compile time.
- Single small dep (~30KB gzipped), no client runtime needed in RSC tree.

Rejected alternatives: `react-i18next` (heavier, client-leaning), DIY (no ICU, brittle plurals).

**2. Locale lives in the path as `[locale]`.**

`app/[locale]/...` segment. All current top-level routes and route groups move under it. The bare root `app/page.tsx` is removed; the new home lives at `app/[locale]/page.tsx`. Stale bookmarks to bare `/matches` etc. land in the middleware, which redirects to `/<resolved-locale>/matches`.

Why path prefix beats cookie-only:
- Shareable links carry the language ("send this to my Spanish-speaking cousin").
- Per-locale canonical URLs and `alternates` work naturally with Next's `Metadata` API.
- Sitemap and SEO bots can index three real URLs instead of one with cookie-dependent content.

**3. Detection chain: `NEXT_LOCALE` cookie → `Accept-Language` → `en`.**

Implemented inside `next-intl`'s `createMiddleware` config. We pass `localePrefix: "always"` so every request must have a locale segment; bare paths are redirected.

For Accept-Language, use `@formatjs/intl-localematcher` (peer dep brought in by `next-intl`) to match the user's preferences against `["en","es","fr"]`.

**4. Compose locale middleware with the existing Supabase auth middleware.**

Order matters: locale must resolve first (to know whether to redirect), then auth refresh runs. We rewrite `middleware.ts` so the function:
1. Runs `next-intl`'s middleware → may return a `RedirectResponse`. If so, return it.
2. Otherwise, run the existing Supabase token refresh on the (possibly-rewritten) request and return that response.

This keeps a single middleware export — Next.js requires that.

**5. Messages directory layout.**

```
messages/
  en.json   ← source of truth
  es.json
  fr.json
```

Top-level keys group by surface: `home`, `matches`, `matchDetail`, `myPicks`, `leaderboard`, `howItWorks`, `admin`, `signIn`, `onboarding`, `errors`, `common`, `metadata`. Nested keys mirror the page component structure. Reviewers can diff translations file-by-file without spelunking through code.

Spanish and French translations are seeded by best-effort translation in the same PR. They are not "machine output" — we want quality, but follow-up edits from native speakers are expected and welcome.

**6. Language switcher: small dropdown in the header.**

`components/language-switcher.tsx` is a client component:
- Reads current locale from `useLocale()`.
- On change: writes the `NEXT_LOCALE` cookie (long expiry, `Path=/`, `SameSite=Lax`) and `router.replace()`s the same path with the new prefix.
- UI: a tiny button group or `<select>` with the three locale display names in their own language: `English / Español / Français`.

Placed inside the global header (defined in `app/[locale]/layout.tsx`), visible everywhere.

**7. Date/number formatting flows through `next-intl`'s formatters.**

`useFormatter()` / `getFormatter()` give locale-aware `Intl.DateTimeFormat` + `Intl.NumberFormat` wrappers. The existing `<LocalTime />` component is rewritten to call into them.

Scores and ranks already use `tabular-nums` and small integers — number formatting changes are mostly cosmetic, but we still pass them through `formatter.number()` so a future "thousand-separator" locale renders correctly.

**8. Type-safe messages.**

Add `global.d.ts`:

```ts
import type messages from "./messages/en.json";

declare global {
  type IntlMessages = typeof messages;
}
```

This makes `t("matches.headline")` type-checked. Missing keys fail `pnpm typecheck`.

**9. Test: message-bundle key parity.**

A new unit test loads `messages/en.json`, `messages/es.json`, `messages/fr.json`, recursively flattens keys, and asserts the three sets are identical. Adding a key to `en.json` without translating it to `es` and `fr` fails CI.

**10. Sitemap emits per-locale entries with `alternates`.**

For each route, emit one entry per locale, with the `alternates.languages` map pointing back at the other two. This is the canonical Next.js i18n sitemap pattern.

## Risks / Trade-offs

- **Risk**: massive PR diff. Touches every page. → **Mitigation**: review by surface (e.g. `messages/*.json` separately from route restructure). Atomic single PR keeps locale routing + content shift consistent.
- **Risk**: redirect loop from misconfigured middleware. → **Mitigation**: `next-intl` middleware handles redirect logic — we don't reinvent it. Add a smoke test that GETs `/`, `/matches`, `/es/matches`, `/zz/matches` and checks expected redirects.
- **Risk**: Spanish/French translations are imperfect on day 1. → **Mitigation**: ship best-effort, mark `es` and `fr` as v1, invite review. Cheap to iterate per-key without code changes.
- **Risk**: `next-intl` API differs across versions; install latest v4. → **Mitigation**: pin to a specific minor; docs link is `https://next-intl.dev/docs/getting-started/app-router`. Cross-check against `node_modules/next/dist/docs/` for any Next.js 16-specific deprecations.
- **Risk**: server-action redirects forget the locale. → **Mitigation**: a tiny `localePath(locale, path)` helper in `lib/i18n.ts` used wherever we redirect. Server actions that do `redirect("/sign-in?next=…")` get the helper.
- **Risk**: SEO regression while crawlers re-index. → **Mitigation**: redirects are 308 (permanent) from bare paths to the default locale; per-locale canonical URLs ensure no duplicate-content penalty.

## Migration Plan

1. Add `next-intl` dep + minimal config (`next-intl.config.ts`, `i18n.ts`).
2. Create `messages/en.json` from a sweep of existing English strings.
3. Translate `es.json`, `fr.json` with key parity.
4. Move pages under `app/[locale]/`. Update imports. Replace hardcoded strings with `t(…)`.
5. Update root `app/layout.tsx` to be minimal; `app/[locale]/layout.tsx` carries the locale-aware shell (HTML lang attribute, header with switcher).
6. Rewrite `middleware.ts` to chain locale + Supabase.
7. Update `app/sitemap.ts` to emit per-locale entries.
8. Add the language switcher component + tests.
9. Typecheck, lint, test, validate.
10. Manual visual check across all three locales in dev.

Rollback: revert the PR. No DB state, no external resources.

## Open Questions

None blocking. Future questions to revisit later (out of scope here):
- Should profiles store a `preferred_locale` column so the cookie isn't the only signal?
- Should Supabase Auth emails be localized? (Requires Supabase Auth template work.)
- Worth localizing date formatting per region within Spanish (es-MX vs es-ES)? Currently a single `es` is sufficient.
