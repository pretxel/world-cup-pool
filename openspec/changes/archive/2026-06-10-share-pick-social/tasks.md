# Tasks: share-pick-social

## 1. Foundations

- [x] 1.1 Read `node_modules/next/dist/docs/` guidance on `ImageResponse`/`next/og` and route handlers (project rule: docs before code; Next 16 may differ from training data)
- [x] 1.2 Create `lib/share.ts`: `clampGoals`, `buildPickSharePath(locale, matchId, h, a)`, `buildTweetIntentUrl(text, url)`, `buildFacebookShareUrl(url)` — pure functions
- [x] 1.3 Add `sharePick` namespace to `messages/en.json`, `messages/es.json`, `messages/fr.json` (share text template, section heading, button labels, share-page heading/CTA, copied-toast)
- [x] 1.4 Unit tests for `lib/share.ts` (clamping, URL encoding, locale paths) and a cross-locale key-parity test for `sharePick` following the repo's existing message-parity test pattern if one exists

## 2. Share landing page + OG card

- [x] 2.1 Create `app/[locale]/(public)/share/pick/[matchId]/page.tsx`: fetch match by id (404 via `notFound()`), parse/clamp `h`/`a` from searchParams, render teams + flags + score + kickoff + CTA to match page; `generateMetadata` with localized title/description, `robots: { index: false }`, `openGraph.images` and `twitter` card pointing at the OG route with identical params
- [x] 2.2 Create the OG image route handler (`ImageResponse`, 1200×630): team names, flags (fetch from deployment origin, initials fallback), score numerals, stage chip, wordmark; 404 on unknown match; long-lived public cache headers
- [x] 2.3 Make the share page responsive 320px+ (reuse stacked-scoreboard pattern) and verify in en/es/fr

## 3. Share buttons on match detail

- [x] 3.1 Create `components/share-pick-buttons.tsx` (client): X anchor, Facebook anchor, native `navigator.share` button (feature-detected after mount), copy-link with sonner toast; props only (`shareUrl`, `shareText`, labels)
- [x] 3.2 Render share section on `app/[locale]/(public)/matches/[matchId]/page.tsx` when `myPrediction != null` (all lock states), passing absolute share URL (site origin + localized path) and localized text
- [x] 3.3 Verify the section is absent for anonymous viewers and pick-less viewers

## 4. Validation

- [x] 4.1 `npm run lint`, `npm run typecheck`, `npm test` — all green
- [x] 4.2 Headless audit: share page at 320/768/1280 in en/es/fr (no overflow, names readable); OG route returns image with correct dimensions; share page HTML contains og:image/twitter:card meta with matching params
- [x] 4.3 Manual-style check of intent URLs (decode and eyeball X text, FB `u=`) and copy-link toast in the browser
