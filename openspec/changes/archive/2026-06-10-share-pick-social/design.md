# Design: share-pick-social

## Context

Match detail (`/matches/[matchId]`) already knows `myPrediction` server-side. The app is Next.js App Router (v16), next-intl for i18n (en/es/fr), Supabase for data, deployed on Vercel. No existing `ImageResponse`/OG-image code in the repo. Platform constraints drive the design:

- **Facebook** `sharer.php` renders only the shared URL's Open Graph card — custom text is ignored.
- **X/Twitter** `intent/tweet` accepts `text` + `url`, and renders the URL's Twitter Card.
- **Instagram** has no web share endpoint; the only web path is the OS share sheet (`navigator.share`) on mobile.

So the pick itself must live in a URL whose OG/Twitter card draws the pick.

## Goals / Non-Goals

**Goals:**
- One tap from a saved pick to a share sheet / prefilled tweet / FB share dialog.
- Shared link unfurls into a card showing the actual predicted score on FB/X/WhatsApp/Telegram.
- Share landing page converts visitors: shows the pick, links to the match to make their own.
- Localized (en/es/fr); responsive 320px+ (per existing match-presentation requirements).

**Non-Goals:**
- No server-side share tokens or share-tracking analytics (can come later).
- No image download button for IG stories (share sheet covers it; revisit if asked).
- No share UI on `/my-picks` rows in this change (detail page only; cheap follow-up).
- No leaderboard/groups sharing.

## Decisions

### 1. Pick travels in query params, not in a stored token

Share URL: `/{locale}/share/pick/{matchId}?h=2&a=1`. The page validates: match must exist (else 404), `h`/`a` parsed as integers clamped to 0–20 (the prediction form's `MAX_GOALS`); missing/invalid params → render without scores ("X is backing Mexico vs South Africa") rather than erroring.

- *Alternative — store a share row and use `/share/<token>`:* rejected; adds writes, RLS surface, and cleanup for zero user value. The user is voluntarily publishing exactly two small integers.
- Privacy: the URL only contains what the user chose to share. The share page never queries the predictions table.

### 2. Dedicated OG image route handler, not the `opengraph-image` file convention

`app/api/og/pick/route.tsx` returns `ImageResponse` (from `next/og`, bundled with Next), reading `matchId`, `h`, `a` from `searchParams`. The file convention (`opengraph-image.tsx`) only receives route params — it cannot see query strings, so it cannot draw the score. The share page's `generateMetadata` points `openGraph.images` and `twitter.images` (`summary_large_image`) at the API route with the same query params. 1200×630, team names + flags + score numerals + stage chip + wordmark, brand colors. Flags loaded by `fetch`ing the existing `/flags/*.svg` from the deployment origin inside the route; if a flag is missing, fall back to initials (mirrors `TeamFlag`'s placeholder behavior).

### 3. `SharePickButtons` is a small client component fed entirely by props

Server (match detail) computes the share URL and localized share text, passes them down; the component holds zero data logic. Buttons:

- **X**: `https://twitter.com/intent/tweet?text=<text>&url=<shareUrl>` (anchor, `target="_blank"`, `rel="noopener"`).
- **Facebook**: `https://www.facebook.com/sharer/sharer.php?u=<shareUrl>` (anchor, same).
- **Share…** (native): rendered only when `typeof navigator.share === "function"` (after mount, to avoid hydration mismatch); calls `navigator.share({ text, url })`. This is the Instagram path on mobile.
- **Copy link**: always rendered; `navigator.clipboard.writeText` + toast (sonner already in repo).

Rendered on match detail under the prediction section when `myPrediction != null`, regardless of locked state (sharing a locked pick is fine — arguably the best moment).

### 4. Share text and URL building live in `lib/share.ts`

Pure functions: `buildPickSharePath(locale, matchId, h, a)` and intent-URL builders — unit-testable with vitest (the repo's existing test pattern for `lib/`). Share text from the `sharePick` namespace, e.g. en: `"My pick: {home} {h}–{a} {away} · WC26 Pool"`.

### 5. Share page is `noindex`

`robots: { index: false }` — parameterized user content; avoids duplicate-content SEO noise while staying crawlable enough for OG scrapers (scrapers fetch meta regardless of robots).

## Risks / Trade-offs

- [Anyone can craft a share URL with any score — it's unauthenticated data] → Accepted by design; the card says "pick", never implies an official result. Clamping prevents absurd numbers.
- [`ImageResponse` flag fetch adds latency to card generation] → Cache headers on the OG route (`public, immutable, max-age` long) — same params always produce the same image; scrapers cache aggressively anyway.
- [`navigator.share` availability differs (desktop Safari yes, desktop Chrome partial, Firefox no)] → Feature-detect after mount; copy-link is the universal fallback.
- [Locked/final matches: shared "pick" for a finished match looks stale] → Card includes kickoff date; acceptable. Future: show real result next to pick post-final.
- [next-intl message interpolation in OG route] → OG route loads messages directly (server-side `getTranslations` with explicit locale param, as `generateMetadata` already does in the codebase).

## Open Questions

None blocking. Follow-ups parked in Non-Goals (my-picks entry point, IG story image download, share analytics).
