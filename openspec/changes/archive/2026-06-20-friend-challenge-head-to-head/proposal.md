# Friend Challenge — Head-to-Head

## Why

The analysis (`análisis.md`, section 4 "Apuestas grandes" and section 5.B "Competitivo") calls out that sharing has no return loop and that mid-table players lack an "alcanzable" (reachable) rivalry. Today the only one-to-one comparison a player can make is reading two rows off `/leaderboard` themselves. There is no shareable artifact that frames a direct rivalry, and the share surfaces that exist (`/share/rank`, `/share/quiz`) only ever show a single player.

A head-to-head page turns the most natural social hook — "I'm beating you" — into a shareable OG card. It rides infrastructure that already shipped: the public `v_leaderboard_overall` view, the `scores` table, the `/share/*` landing-page pattern (cookie-less SSR + `noindex` + OG metadata), the OG route pattern (`app/api/og/rank`, ETag cache via `lib/og-cache.ts`, fonts via `lib/og-fonts.ts`), `lib/share.ts` URL builders, the `ShareButtons` component, and `trackEvent` analytics. This is mostly read-only: one new public route, one new OG route, a few share helpers, and an optional read-side query for recent form. It is explicitly listed in the long-term roadmap (section 7) as "Friend challenge head-to-head con OG card".

## What Changes

- Add a public, locale-aware head-to-head landing page that compares exactly two players by their `user_id` (route shape `/[locale]/h2h/[a]/[b]`). It reads both standings live from `v_leaderboard_overall` (rank, points, exact hits) and a "recent form" strip per player derived from the most recent scored matches in `scores`. It is `noindex` (matching the existing share landing pages) and renders OG/Twitter card metadata.
- Add an OG image route (`/api/og/h2h`) that rasterizes a two-column "VS" scoreboard card (name, rank, points, exact hits, recent-form pips per player) using the same Node-runtime + ETag + brand-font pipeline as `/api/og/rank`.
- Add share-URL builders in `lib/share.ts` (`buildH2HPath`, and a stable ordering helper so `a` vs `b` and `b` vs `a` resolve to one canonical URL) and surface a "Challenge" affordance from the leaderboard so a logged-in player can build a head-to-head link against any listed opponent, reusing `ShareButtons` (new `context: "h2h"`).
- Add a read-only "recent form" query helper (last N scored matches per user, win/exact/miss classification from `scores.hit_type`) shared by the landing page and the OG route, and `h2h.*` i18n strings.
- Instrument `trackEvent` for head-to-head view and challenge-link creation, consistent with existing `share_click` / `leaderboard_view` events.

## Capabilities

### New Capabilities

- `friend-challenge-head-to-head`: A public, shareable one-to-one comparison of two players (rank, points, exact hits, recent form) rendered as both an HTML landing page and an Open Graph card, built on the existing leaderboard view, scores table, and share/OG infrastructure.

### Modified Capabilities

## Impact

- New code: one public route group (`app/[locale]/(public)/h2h/[a]/[b]/{page,loading}.tsx`), one OG route (`app/api/og/h2h/route.tsx`), additions to `lib/share.ts`, a small read-only form helper (e.g. `lib/h2h.ts`), an `h2h` i18n namespace, and a "Challenge" entry point on the leaderboard.
- Data: read-only. Reads `v_leaderboard_overall` and `scores`; no schema migration is required for the baseline. An optional follow-up (recent-form RPC and/or a `head_to_head` analytics/log table) is called out as a phase, not a baseline requirement.
- Competitive scoring: unaffected. The page is a read-only projection; it never writes to `scores` or touches the leaderboard tie-breakers.
- Infra: no new cron, realtime channel, service worker, web push, or VAPID keys. Reuses the existing OG ETag/CDN caching (`OG_CACHE_CONTROL`).
- SEO: the landing page is `noindex` like the other `/share/*` pages, so it does not change the indexable surface; only OG/Twitter unfurls are affected.
