## Why

Today the brand is a tiny `26` tile + a "WC26 Pool" text string in the nav, a leftover generic favicon from `create-next-app`, and an OG card that reuses the product name as a heading. There is no real logotype — nothing that carries a visual identity across the nav, footer, social cards, and a browser tab. For a tournament product that will end up screenshotted on phones and shared in group chats, an identifiable wordmark matters.

This change introduces a custom typographic **WC26 wordmark** (with a pitch/ball accent) and a matching favicon set, then uses them consistently across nav, footer, OG card, hero, and browser tab.

## What Changes

- New `Logotype` React component: inline SVG wordmark featuring `WC` (heavy, condensed), a stylized `26` enclosed by a soft pitch-stripe shape, and an optional `· Pool` lockup. Three sizes — `xs` (nav/footer), `md` (in-page), `xl` (hero accent). One color variant (currentColor-based, so it adapts to theme).
- **BREAKING (visual):** The current `<span>26</span>` tile + "WC26" text in `SiteNav` is replaced by `<Logotype size="xs" />`. The footer's "26" tile is also replaced. The hero on `/` gets a large `Logotype size="xl"` accent next to the headline.
- `app/opengraph-image.tsx` rewritten so the logo is the visual anchor — wordmark on the top-left, headline below, no more body-copy heavy layout.
- New favicon assets in `app/`:
  - `app/icon.svg` (resizable, modern browsers).
  - `app/icon.png` (32×32, ICO-style fallback via Next's file-based metadata).
  - `app/apple-icon.png` (180×180, for iOS home-screen).
  - The existing `app/favicon.ico` is removed; Next 16's file-based metadata picks up the new conventions automatically.
- `app/layout.tsx`'s manual `icons: { icon: "/favicon.ico", ... }` block is removed since Next derives icons from the new `app/icon.*` + `app/apple-icon.*` files.

## Capabilities

### New Capabilities
- `brand-identity`: rules governing the logotype and favicon — what they are, where they appear, and what variants exist.

### Modified Capabilities
<!-- none — no existing brand spec. -->

## Impact

- Code: `components/logotype.tsx` (new); `components/site-nav.tsx` (header + footer brand mark); `app/[locale]/page.tsx` (hero accent); `app/opengraph-image.tsx` (rewrite); `app/layout.tsx` (drop manual icon metadata).
- Assets: `app/icon.svg`, `app/icon.png`, `app/apple-icon.png` (new); `app/favicon.ico` (removed). `public/site.webmanifest` updated if it references the old icon paths.
- Tests: lightweight smoke test that `Logotype` renders an `<svg>` for each size.
- No DB changes. No new runtime deps.
- Bundle: inline SVG is ~1 KB per render. Favicon PNGs are small (~2 KB each). No external requests.
