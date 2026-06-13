## Context

`app/api/og/rank/route.tsx` renders the leaderboard share card with `next/og`'s `ImageResponse` (Satori → resvg → PNG, 1200×630). It is `force-dynamic`, reads the standing + player count live from `v_leaderboard_overall` (two parallel queries via `Promise.all`), and returns `Cache-Control: public, max-age=300, s-maxage=300`. It passes **no** `fonts`, so every glyph renders in Satori's bundled fallback rather than the brand typefaces used everywhere else (`Bricolage Grotesque` heading, `JetBrains Mono` mono, loaded app-side via `next/font/google` in `app/layout.tsx`).

Constraints that shape this design:

- **Runtime**: the route declares no `runtime`, so it runs on **Node** (Fluid Compute). `node:fs/promises#readFile` is available; the `@vercel/og` **500KB Edge bundle cap does not apply**. Subsetting fonts is therefore an optimization (parse speed, instance memory), not a hard wall.
- **Font formats**: `ImageResponse` accepts only `ttf`/`otf`/`woff`; `ttf`/`otf` parse fastest. Brand fonts currently exist only as Google `woff2` in the client bundle — not a usable source for Satori.
- **Truthfulness invariant** (existing spec): numbers are always re-derived live from `v_leaderboard_overall`, never trusted from the URL. This change must preserve that.
- **Cost shape**: the dominant per-request cost is rasterization (Satori layout + resvg encode), not the two cheap parallel DB reads. Any caching win should target *skipping the raster*.

## Goals / Non-Goals

**Goals:**
- Render the rank number and display name in `Bricolage Grotesque` and the labels in `JetBrains Mono`, matching the on-site scoreboard card.
- Tighten the card composition toward the `/share/rank` landing layout within Satori's supported CSS subset.
- Add conditional caching: a content-derived `ETag` + `If-None-Match` → `304` short-circuit that skips rasterization for unchanged standings, plus `stale-while-revalidate`.
- Keep the rasterized PNG small (subsetted fonts, no heavy imagery) so it downloads fast on mobile.
- Reuse the font-loader for the pick card (`/api/og/pick`) if it lands cheaply.

**Non-Goals:**
- No change to share URLs, share buttons, the landing-page contract, or which fields are displayed.
- No database schema or view change. Reducing the two reads to a single SQL call would require altering `v_leaderboard_overall` — out of scope; the two reads already run in parallel (one round-trip of latency).
- No switch to the Edge runtime.
- No animated, video, or multi-format (WebP/AVIF) output — `ImageResponse` emits PNG.

## Decisions

### 1. Bundle subsetted brand fonts as local `.ttf`, loaded via `readFile` + memoized

Ship subsetted `Bricolage Grotesque` (the weights the card uses, e.g. 700/800) and `JetBrains Mono` (700) as `.ttf` under `assets/og/` (or `public/`-adjacent, server-only). Load them with `readFile(join(process.cwd(), "assets/og/<file>.ttf"))` inside a **module-scoped memoized loader** (`lib/og-fonts.ts`) so a warm Fluid instance parses each font once and reuses the `ArrayBuffer` across invocations.

- **Why local over runtime-fetch from Google Fonts**: deterministic, no network dependency on the render hot path, works in CI/offline, no third-party latency or rate-limit coupling. Trade-off: a binary asset in the repo and a manual re-subset if weights change.
- **Why subset**: the labels and digits are app-controlled (known glyphs); subsetting to Latin + Latin-1 Supplement + Latin Extended-A keeps files small while still covering en/es/fr display names with accents.
- **Alternative considered — runtime `fetch` of the Google `ttf`**: simpler asset story, full glyph coverage, but adds a network hop and failure mode to every cold render. Rejected for the hot path; acceptable only as a degraded fallback.

### 2. Name-font glyph coverage is Latin-Extended; exotic scripts degrade to fallback

Display names are arbitrary user input. The subsetted name font covers Latin scripts (en/es/fr and most European names). A name in a script outside the subset (e.g. CJK, Cyrillic, Arabic) renders in Satori's fallback for those glyphs rather than failing. Keep a fallback font configured so such names never produce tofu boxes for the whole string. This is an accepted, documented trade-off, not a bug.

### 3. Strong `ETag` from the rendered inputs + a card-version constant

Compute `ETag` as a hash of the exact inputs that determine the pixels: `rank`, `display_name`, `total_points`, `exact_hits`, `player count`, `locale`, and a `CARD_VERSION` constant. Read the standing first, derive the ETag, then:

- If the request's `If-None-Match` equals the ETag → return `304 Not Modified` (empty body) **before** constructing `ImageResponse`, skipping the raster entirely.
- Otherwise render and attach the `ETag` header.

Bump `CARD_VERSION` whenever the layout/fonts change so a redeploy invalidates cached cards even when the standing is unchanged.

- **Why hash live inputs**: the ETag changes exactly when the visible card changes, preserving the truthfulness invariant — a stale CDN copy revalidates to a fresh card the moment points move.
- **Alternative — `Last-Modified`/time-based**: the standing has no single mtime; content hashing is the correct primitive here.

### 4. Caching header: keep finite TTL, add `stale-while-revalidate`

`Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600`. The finite max-age (never `immutable`) is unchanged and still required by spec. SWR lets a CDN serve the slightly-stale card instantly while revalidating in the background; combined with the ETag, revalidation is a cheap `304` when nothing changed.

### 5. Composition within Satori's CSS subset

Mirror the `/share/rank` scoreboard look using only Satori-supported CSS (flexbox, absolute positioning, linear/radial gradients — **no** `grid`, limited texture support). Layer the existing pitch gradient, set the heading with the condensed brand face and the labels in mono, and align spacing/scale to the landing card. Avoid relying on CSS textures (stripes/grain) that Satori can't reproduce; approximate with layered gradients if a texture cue is wanted.

### 6. Extract a shared loader; apply to the pick card opportunistically

Put font loading + the ETag helper in small shared utils so `/api/og/pick` can adopt the same brand fonts and conditional caching with minimal diff. Treat the pick-card change as opportunistic — land it in the same PR only if it stays low-risk; otherwise leave a follow-up.

## Risks / Trade-offs

- **Subsetted font misses a name's glyphs** → tofu/odd fallback for non-Latin names. → Mitigation: subset to Latin-Extended (covers en/es/fr); keep a fallback font configured so the rest of the string still renders.
- **Larger function memory / cold-start from font parsing** → slower first render. → Mitigation: subset the `.ttf` and memoize the parsed buffers at module scope so only the first invocation per instance pays the cost.
- **ETag derived from inputs could go stale if a field is omitted from the hash** → a changed card served as `304`. → Mitigation: hash every field the card renders, plus `CARD_VERSION`; add a test asserting the ETag changes when any input changes.
- **Satori CSS limits** → the on-site textures (stripes/grain) can't be reproduced exactly. → Mitigation: accept a simplified gradient composition; match typography and layout, not pixel-identical texture.
- **Accidental Edge runtime** would break `readFile` and reimpose the 500KB cap. → Mitigation: keep the route on Node (no `runtime = "edge"`); the memoized loader uses `node:fs/promises`.
- **Repo carries binary font assets** → review noise, license compliance. → Mitigation: both families are OFL-licensed; store under a clear `assets/og/` path with a note on how the subset was produced.

## Migration Plan

Purely additive and behavior-preserving for users: same URLs, same numbers, same flow. Deploy is a standard rollout; rollback is a revert (the route falls back to the current fallback-font behavior). Cache busting on layout changes is handled by `CARD_VERSION`, not a manual purge. No data migration.

## Open Questions

- Final subset range and whether to commit pre-subsetted `.ttf` files or generate them in a build step. Default: commit pre-subsetted files for simplicity.
- Whether to land the `/api/og/pick` font+cache change in this PR or as an immediate follow-up — decide based on diff size during implementation.
