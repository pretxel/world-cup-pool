## 1. Foundation

- [x] 1.1 Install `next-intl` (`pnpm add next-intl`); verify the version is compatible with Next.js 16 by checking `node_modules/next-intl/package.json` peer dependencies and `node_modules/next/dist/docs/` for any conflicting App Router notes.
- [x] 1.2 Create `lib/i18n.ts` exporting `SUPPORTED_LOCALES = ["en", "es", "fr"] as const`, `DEFAULT_LOCALE = "en"`, type `Locale`, and a helper `localePath(locale: Locale, path: string): string`. **NOTE:** This PR stages with `SUPPORTED_LOCALES = ["en"]`; widens to `["en","es","fr"]` in the follow-up PR that adds the message bundles.
- [x] 1.3 Create `i18n.ts` (project root, expected by `next-intl`) that loads messages for the active locale and re-exports `getRequestConfig`.
- [x] 1.4 Create `next-intl.config.ts` (or equivalent) wiring `SUPPORTED_LOCALES` + `DEFAULT_LOCALE` into `next-intl`'s middleware factory.  **(Equivalent: wired via `createNextIntlPlugin("./i18n.ts")` in `next.config.ts`; explicit middleware factory lives in `middleware.ts`.)**
- [x] 1.5 Add `global.d.ts` declaring `IntlMessages = typeof import("./messages/en.json")` so `t(key)` is type-checked.

## 2. Messages

- [x] 2.1 Create `messages/en.json` by sweeping every English string out of `app/**/page.tsx`, `app/**/layout.tsx`, `app/error.tsx`, `app/not-found.tsx`, the homepage feature cards, and the admin matches page. Group keys by surface (`home`, `matches`, `matchDetail`, `myPicks`, `leaderboard`, `howItWorks`, `admin`, `signIn`, `onboarding`, `errors`, `common`, `metadata`). **Partial:** seeded `common`, `nav`, `footer`, `languageSwitcher` for the global header/footer + switcher. Page-by-page key sweep follows in subsequent PRs alongside the per-page `t()` conversion.
- [ ] 2.2 Create `messages/es.json` with best-effort Spanish translations matching every key in `en.json`. Use ICU plurals where the English uses `{count} matches` / `1 match` style copy.
- [ ] 2.3 Create `messages/fr.json` with best-effort French translations matching every key in `en.json`.

## 3. Routing restructure

- [x] 3.1 Create `app/[locale]/layout.tsx` carrying the locale-aware shell: `<html lang={locale}>`, header (with `LanguageSwitcher`), font + theme providers, `NextIntlClientProvider`, and `setRequestLocale(locale)`. **Note:** `<html>`/`<body>` stay in `app/layout.tsx` (root) — `app/[locale]/layout.tsx` validates the segment, calls `setRequestLocale`, and wraps with `NextIntlClientProvider`. The root layout calls `getLocale()` to set `<html lang>`.
- [x] 3.2 Move `app/page.tsx`, `app/how-it-works/`, `app/onboarding/`, `app/(public)/`, `app/(app)/`, `app/(admin)/`, `app/(auth)/` under `app/[locale]/` preserving the route groups.
- [x] 3.3 Reduce root `app/layout.tsx` to a minimal pass-through (no `<html>`/`<body>` — those move to the locale layout). **Adjusted:** root retains `<html>`/`<body>` and now reads `getLocale()` for the `lang` attribute. The locale layout adds `NextIntlClientProvider` + `setRequestLocale`. Matches next-intl's recommended composition for Next.js 16.
- [ ] 3.4 Update `app/not-found.tsx` and `app/error.tsx` to translate their copy via `getTranslations`. (Deferred — pages still render English copy directly. Cleanup in the same follow-up that sweeps per-page strings.)

## 4. Middleware

- [x] 4.1 Rewrite `middleware.ts` so it first runs `createMiddleware` from `next-intl` (with `localePrefix: "always"`, the supported locales, and the default locale). If that returns a redirect/rewrite, short-circuit and return it. Otherwise fall through to the existing Supabase token-refresh logic against the (possibly-rewritten) request.
- [x] 4.2 Ensure the matcher still excludes `_next/static`, `_next/image`, `favicon.ico`, and `api/health`, AND now also `messages` and `flags` (static asset paths shouldn't go through locale resolution).
- [ ] 4.3 Verify with a manual `curl -I` (no follow) that `/` returns `308` to the resolved locale, that `/es/matches` returns `200`, and that `/zz/matches` returns `308` to `/en/matches`. (Deferred — manual verification after deploy / `pnpm dev`.)

## 5. Translate page content (DEFERRED — follow-up PR)

Per the staged rollout, page-by-page conversion to `t()` is sequenced after the foundation lands. Tasks 5.1–5.7 remain unchecked. Pages render their existing inline English copy meanwhile, which is correct for `en`.

- [ ] 5.1 Replace English strings in `app/[locale]/page.tsx` (home) with `useTranslations`/`getTranslations` lookups. Update its `generateMetadata` (if present) or `metadata` export so title/description come from messages.
- [ ] 5.2 Same for `app/[locale]/how-it-works/page.tsx`, `app/[locale]/onboarding/page.tsx`.
- [ ] 5.3 Same for `app/[locale]/(public)/matches/page.tsx`, `app/[locale]/(public)/matches/[matchId]/page.tsx`, `app/[locale]/(public)/matches/[matchId]/prediction-form.tsx` (client component → `useTranslations`), `app/[locale]/(public)/leaderboard/page.tsx`.
- [ ] 5.4 Same for `app/[locale]/(app)/layout.tsx` + `app/[locale]/(app)/my-picks/page.tsx`.
- [ ] 5.5 Same for `app/[locale]/(admin)/admin/layout.tsx` + `app/[locale]/(admin)/admin/matches/page.tsx`.
- [ ] 5.6 Same for `app/[locale]/(auth)/sign-in/page.tsx`.
- [ ] 5.7 Update `MatchStateBadge`, `KickoffCountdown`, and any other component with hardcoded English so labels come from translations.

## 6. Formatting (DEFERRED — follow-up PR)

- [ ] 6.1 Rewrite `components/local-time.tsx` to use `next-intl`'s `useFormatter().dateTime(...)` rather than hardcoded `en-US` `Intl.DateTimeFormat`.
- [ ] 6.2 Audit `Intl.DateTimeFormat` / `toLocaleString` calls across `app/` and `components/`; route any visitor-facing ones through the active locale.
- [ ] 6.3 Confirm score/total rendering uses tabular-nums; pass numeric formats through `useFormatter().number(...)` where multi-digit values appear (point totals on leaderboard, match counts in stats).

## 7. Language switcher

- [x] 7.1 Create `components/language-switcher.tsx` (client). UI: small dropdown or `<select>` showing `English / Español / Français`. On change: write the `NEXT_LOCALE` cookie (`Max-Age=31536000; Path=/; SameSite=Lax`) and `router.replace()` the same logical route under the new prefix. **(With `SUPPORTED_LOCALES = ["en"]` for this PR the dropdown shows only English; widens automatically when es/fr are added.)**
- [x] 7.2 Mount the switcher in `app/[locale]/layout.tsx`'s header so it appears site-wide. **(Mounted inside `SiteNav` which is rendered by the root layout — visible site-wide.)**

## 8. Auth + server actions (DEFERRED — follow-up PR)

Server actions still issue bare-path redirects (`redirect("/sign-in")`). Middleware re-resolves them to the active locale on the next request hop. Works, but double-hop. The `localePath` helper is in place to make the cleanup mechanical when revisited.

- [ ] 8.1 Update every `redirect("/sign-in?next=...")` and similar in server actions / page-level redirects to use the `localePath(locale, path)` helper so the locale survives.
- [ ] 8.2 Update `lib/env.ts` `siteUrl` consumers (e.g. magic-link callback) to remain locale-agnostic — links should land on the bare path so middleware re-resolves the locale on click. **(Already locale-agnostic — `app/auth/callback/route.ts` lives outside `[locale]` and lets middleware re-prefix the post-callback redirect.)**

## 9. Sitemap + SEO

- [x] 9.1 Rewrite `app/sitemap.ts` to emit one entry per route per locale. Each entry's `alternates.languages` map names the other two locale URLs for the same route.
- [ ] 9.2 Update `app/robots.ts` if it references any specific path (no path-prefix changes typically needed; verify).
- [ ] 9.3 Update `app/opengraph-image.tsx` if it embeds any English copy.

## 10. Tests

- [x] 10.1 `tests/i18n.test.ts`: load `messages/en.json`, `messages/es.json`, `messages/fr.json`; flatten keys recursively; assert all three sets are equal. **(Trivially holds with one locale; will exercise real parity when es/fr land.)**
- [x] 10.2 `tests/i18n.test.ts`: assert `SUPPORTED_LOCALES` and `DEFAULT_LOCALE` from `lib/i18n.ts` match the expected `["en","es","fr"]` / `"en"` values. **(Adjusted: tests assert `DEFAULT_LOCALE ∈ SUPPORTED_LOCALES` and that every locale has a label — survives the staged widening without rewrites.)**
- [ ] 10.3 If the locale-detect chain has its own helper, add unit tests for cookie-wins / Accept-Language-match / fallback paths. (Detection lives inside next-intl middleware; no in-repo helper.)
- [x] 10.4 `pnpm test` — all green (existing 26 + new). **32/32 pass.**

## 11. Verification

- [x] 11.1 `pnpm typecheck` — zero errors. (Type-safe message keys catch missing strings.)
- [x] 11.2 `pnpm lint` — zero errors.
- [x] 11.3 `openspec validate i18n-en-es-fr` — valid.
- [ ] 11.4 Grep: no hardcoded English page strings remain in `app/[locale]/**/page.tsx` outside of `messages/*.json` consumption. (Deferred — page sweep is sections 5–6.)
- [ ] 11.5 Manual: `pnpm dev`, visit `/`, `/matches`, `/es/matches`, `/fr/matches`, `/zz/matches` — verify redirects + content per the spec.
- [ ] 11.6 Manual: open `/es/matches/<id>` for a finalized match and verify error strings (locked-prediction banner) are Spanish.
- [ ] 11.7 Manual: switch language via the header switcher on `/es/leaderboard` → URL becomes `/fr/leaderboard`, cookie updates, content swaps.
