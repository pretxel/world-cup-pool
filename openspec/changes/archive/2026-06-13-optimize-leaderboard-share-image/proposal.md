## Why

The leaderboard share image (`/api/og/rank`) is the face of the growth loop — every shared rank unfurls into this card on X, Facebook, WhatsApp, and iMessage. Today it renders in Satori's generic fallback font (no brand typeface), is marked `force-dynamic` so every scraper hit re-runs two Supabase queries plus a full raster, and serves a plain `max-age=300` cache with no conditional revalidation. The card looks off-brand and costs more to serve than it should — both work against a feature whose only job is to look good and spread cheaply.

## What Changes

- **Brand typography in the card**: render the rank number and display name in Bricolage Grotesque and the labels in JetBrains Mono — the same typefaces as the on-site scoreboard — by loading subsetted font binaries into `ImageResponse`. Replaces the generic Satori fallback.
- **Tighter visual composition**: align the card to the live `/share/rank` scoreboard look (pitch stripes/grain texture cue, condensed heading stretch, consistent spacing) so the shared image and the landing page read as one artifact.
- **Conditional caching**: keep the short finite TTL but add `stale-while-revalidate` and a content-derived `ETag` (hash of rank/points/exact/name/player-count/locale) so unchanged standings return `304 Not Modified` instead of re-rasterizing.
- **Single data read**: collapse the two Supabase round-trips (standing row + player count) into one query path so each cold render does less work.
- **Lighter payload**: subset fonts to the glyphs the card actually uses and confirm the rasterized PNG stays small, so the card downloads fast on slow mobile networks.
- Apply the same font-loading + caching pattern to the sibling pick-share card (`/api/og/pick`) for consistency, if low-cost.

No change to share URLs, the share buttons, the landing page contract, or what data is shown — numbers are still re-derived live from `v_leaderboard_overall`, never trusted from the URL.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `leaderboard-sharing`: the "Share URL unfurls into an Open Graph rank card" requirement gains brand-font rendering and conditional (`ETag`/`304`, `stale-while-revalidate`) caching guarantees. The live-data and 404 guarantees are unchanged.

## Impact

- **Code**: `app/api/og/rank/route.tsx` (fonts, layout, query collapse, cache headers/ETag); a small shared font-loader util (e.g. `lib/og-fonts.ts`); optionally `app/api/og/pick/route.tsx`.
- **Assets**: subsetted Bricolage Grotesque + JetBrains Mono font files (or a cached fetch from Google Fonts) bundled for Satori — these are not currently shipped to the OG runtime.
- **APIs/data**: no schema change; `v_leaderboard_overall` reads only, fewer round-trips.
- **Behavior for users**: identical share flow and numbers; better-looking card, faster repeat/scraper loads. No breaking changes.
