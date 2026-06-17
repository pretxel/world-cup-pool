## 1. Gallery component

- [x] 1.1 Create `components/recent-recap-images.tsx` — an async server component `RecentRecapImages({ locale })` that, via `createServerSupabaseClient()`, queries `match_summary_images` (`storage_path, match_id, created_at, matches(home_team, away_team)`) where `status = "complete"`, ordered by `created_at` desc, `limit(8)`; build public URLs with the `NEXT_PUBLIC_SUPABASE_URL` pattern; defensively narrow the embedded `matches` (skip rows without teams); `return null` when the list is empty
- [x] 1.2 Render a `max-w-6xl` section (eyebrow + heading from `home`) with a responsive grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`) of `Link` cards to `localePath(locale, "/matches/<id>")`, each a plain `<img>` (eslint-disabled) of the comic with team-named alt + a `Home vs Away` caption

## 2. Mount + i18n

- [x] 2.1 Mount `<RecentRecapImages locale={locale} />` in `app/[locale]/page.tsx` after `FeatureSections`
- [x] 2.2 Add `home` namespace strings (recapGalleryEyebrow, recapGalleryHeadline, optional recapGalleryCopy, recapImageAlt with {home}/{away}) to messages/en|es|fr|de.json

## 3. Verification

- [x] 3.1 Run `pnpm lint` + `pnpm typecheck` + test suite
- [x] 3.2 Verify on the landing page: with completed renders, the newest comics show (capped at 8, newest first) and link to their matches; with none, the section is absent and the page renders normally
