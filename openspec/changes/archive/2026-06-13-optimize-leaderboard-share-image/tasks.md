## 1. Brand fonts for OG cards

- [x] 1.1 Produce subsetted `.ttf` files for Bricolage Grotesque (card weights, e.g. 700/800) and JetBrains Mono (700), covering Latin + Latin-1 Supplement + Latin Extended-A; commit under `assets/og/` with a short note on how the subset was generated and the OFL license.
- [x] 1.2 Create `lib/og-fonts.ts`: a module-scoped, memoized loader that reads the `.ttf` files via `readFile(join(process.cwd(), "assets/og/<file>.ttf"))` and returns the `fonts` array shape `{ name, data, weight, style }` for `ImageResponse`, parsing each file at most once per warm instance.
- [x] 1.3 Confirm the rank route stays on the Node runtime (no `export const runtime = "edge"`) so `node:fs/promises` works and the Edge bundle cap does not apply.

## 2. Conditional caching helper

- [x] 2.1 Add a `CARD_VERSION` constant and an ETag helper (e.g. in `lib/og-cache.ts`) that hashes the card inputs (rank, display name, total points, exact hits, player count, locale, `CARD_VERSION`) into a strong `ETag` string.
- [x] 2.2 Add a helper to read `If-None-Match` from the request and decide whether to short-circuit to `304`.

## 3. Rank OG route

- [x] 3.1 In `app/api/og/rank/route.tsx`, after loading the standing, compute the `ETag`; if `If-None-Match` matches, return `304 Not Modified` (empty body) before constructing `ImageResponse`.
- [x] 3.2 Pass the brand fonts from `lib/og-fonts.ts` into `ImageResponse` and update the JSX to use the heading face for the rank number + display name and the mono face for labels.
- [x] 3.3 Tighten the composition toward the `/share/rank` scoreboard layout using only Satori-supported CSS (flexbox, absolute positioning, gradients; no `grid`), keeping a configured fallback font for out-of-subset glyphs.
- [x] 3.4 Update the response headers: attach the `ETag` and set `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600`.
- [x] 3.5 Verify the 404-on-unknown-`userId` path still runs before any render and is unaffected by the ETag/304 logic.

## 4. Pick OG route (opportunistic)

- [x] 4.1 If the diff stays low-risk, apply the same `lib/og-fonts.ts` fonts and ETag/`stale-while-revalidate` caching to `app/api/og/pick/route.tsx`; otherwise leave a follow-up note.

## 5. Verification

- [x] 5.1 Manually request `/api/og/rank?userId=<id>&locale=en` and confirm a 1200×630 PNG renders with brand fonts, the correct standing, and an `ETag` header.
- [x] 5.2 Re-request with `If-None-Match: <that ETag>` and confirm a `304` with no re-raster; change the standing (or `CARD_VERSION`) and confirm the `ETag` changes and a fresh card is served.
- [x] 5.3 Render a card for a display name with accented (es/fr) characters and a non-Latin name; confirm accents render in-font and the non-Latin name falls back without empty boxes.
- [x] 5.4 Confirm the rasterized PNG byte size is reasonable for mobile (spot-check), and that scraping `/{locale}/share/rank/<id>` still exposes correct `og:image`/`twitter:card` metadata.
- [x] 5.5 Run lint/typecheck and the existing test suite; add/adjust a test asserting the `ETag` changes when any card input changes.
