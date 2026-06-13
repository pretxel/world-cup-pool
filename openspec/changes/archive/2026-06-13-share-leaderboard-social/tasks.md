## 1. Share helpers and component

- [x] 1.1 Add `buildRankSharePath(locale, userId)` to `lib/share.ts`, returning `/{locale}/share/rank/{userId}`
- [x] 1.2 Extract the generic button row from `components/share-pick-buttons.tsx` into `components/share-buttons.tsx` as `ShareButtons` (same `{ shareUrl, shareText, labels }` API)
- [x] 1.3 Repoint the match-detail pick share usage (`/matches/[matchId]`) at `ShareButtons`; confirm pick share still renders X/Facebook/native/copy

## 2. Localization

- [x] 2.1 Add a `shareRank` namespace to `messages/en.json`: `shareText` (with `{rank}`, `{count}`, `{points}`), `shareOnX`, `shareOnFacebook`, `shareNative`, `copyLink`, `copied`, `heading`, `pageEyebrow`, `pageHeading`, `pageTitle`, `pageDescription`, `cta`, `ogAlt`
- [x] 2.2 Mirror the `shareRank` namespace into `messages/es.json` (Spanish copy)
- [x] 2.3 Mirror the `shareRank` namespace into `messages/fr.json` (French copy)

## 3. Share section on the leaderboard page

- [x] 3.1 In `app/[locale]/(public)/leaderboard/page.tsx`, when `myRow` exists, build the share URL via `buildRankSharePath(locale, user.id)` and the localized share text from `myRow.rank`, player count, and `myRow.total_points`
- [x] 3.2 Render a share section using `ShareButtons` with `shareRank` labels; render nothing for anonymous or unranked viewers
- [x] 3.3 Verify no scope tabs, date input, or `tz`-cookie usage was introduced

## 4. Public rank share landing page

- [x] 4.1 Create `app/[locale]/(public)/share/rank/[userId]/page.tsx`; read the row from `v_leaderboard_overall` by `user_id` at request time, ignoring any URL rank/points params
- [x] 4.2 Render rank, display name (with the leaderboard no-name fallback), points, exact-hit count, total player count, and a CTA linking to `/leaderboard`
- [x] 4.3 Return `notFound()` when the user has no row in the view
- [x] 4.4 Add `generateMetadata` with `robots: noindex`, Open Graph + `summary_large_image` Twitter card pointing at `/api/og/rank?userId=...&locale=...`

## 5. Open Graph rank card

- [x] 5.1 Create `app/api/og/rank/route.tsx` using a cookie-less anon Supabase client to read the row from `v_leaderboard_overall` by `userId`
- [x] 5.2 Render a 1200×630 brand scoreboard card showing rank, display name, and points; return 404 for an unknown `userId`
- [x] 5.3 Set `Cache-Control: public, max-age=300, s-maxage=300` (finite, not `immutable`)

## 6. Verification

- [x] 6.1 Manually share from `/en/leaderboard`, `/es/leaderboard`, `/fr/leaderboard`; confirm intent text and `/share/rank/` URL locale match
- [x] 6.2 Open a share link with tampered `?rank=1&points=999` and confirm the page renders the live standing
- [x] 6.3 Confirm unknown `userId` 404s on both the landing page and `/api/og/rank`
- [x] 6.4 Confirm the `shareRank` namespace key set is identical across en, es, fr
- [x] 6.5 Run typecheck/lint and the existing pick-share checks to confirm the `ShareButtons` rename caused no regression
