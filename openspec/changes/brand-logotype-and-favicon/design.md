## Context

Current state across the brand surface:
- `components/site-nav.tsx`: brand is a `grid size-7` square with `26` text + the literal string `WC26` + a small mono `Pool` chip. Hard-coded inline; no shared component.
- `app/layout.tsx`: declares `icons: { icon: "/favicon.ico", shortcut: "/favicon.ico", apple: "/favicon.ico" }`. The pointed-to `app/favicon.ico` is the generic `create-next-app` icon.
- `app/opengraph-image.tsx`: text-only OG card with green dot accent. No logo.
- `app/[locale]/page.tsx`: hero headline is text-only on the left, `MiniBracket` card on the right (just added in the landing imagery change).

Next.js 16 picks up icons via the file-based metadata convention: `app/icon.{svg,png,jpg}`, `app/apple-icon.{png,jpg}`, `app/favicon.ico`. Any of these in the `app/` directory is auto-resolved into the rendered `<head>` — no manual `metadata.icons` config needed.

`app/opengraph-image.tsx` is rendered by `next/og` at request time, returning a `1200×630` PNG. The renderer supports a Satori-flavored subset of CSS + inline SVG.

## Goals / Non-Goals

**Goals:**
- One canonical wordmark component, reused everywhere — single source of truth for the brand mark.
- Theme-aware: the logotype renders in `currentColor` so dark and light modes share the same SVG.
- A favicon that reads at 16×16 in a browser tab (so: bold, very few strokes, high contrast).
- Modern SVG-first icon + ICO/PNG fallback covering iOS and legacy browsers.
- Reuse exists where it makes sense (e.g., the pitch-stripe motif already used in the hero background gets echoed in the logotype).

**Non-Goals:**
- Not a full brand system — no typography scale, no swatch system, no spacing tokens. The logotype is a single component, no companion marks yet.
- No alternate locale-specific wordmark (e.g. an "ES" badge for `/es`). The wordmark is locale-agnostic.
- No animated favicon, no SVG-favicon dark-mode `prefers-color-scheme` magic — keep it static and simple.

## Decisions

**1. Wordmark composition.**

```
WC|26 · Pool
```

- `WC` in the heading font (`Bricolage Grotesque`, condensed weight) — heavy, slightly tight tracking.
- A vertical pitch-stripe rule between `WC` and `26` (the same `bg-pitch-stripes` motif used elsewhere, but expressed as a narrow rounded rect).
- `26` in mono numerals (`JetBrains Mono`) inside a slightly larger, rounded pitch-green tile.
- A small mono `· Pool` suffix to the right, optional via prop (collapses on the `xs` variant for tab/footer).

This composition turns the existing visual vocabulary into a single brand mark instead of three scattered hints.

**2. One SVG, scaled via the viewBox.**

The `Logotype` is one `<svg>` with `viewBox="0 0 240 64"`. Sizes (`xs` / `md` / `xl`) just adjust `width` / `height` on the outer element. No three separate SVGs.

For `xs`, where the `· Pool` suffix becomes illegible, we conditionally trim the SVG via a `compact` prop — same component, different prop combination. This avoids re-implementing the geometry.

**3. Colors.**

- The `WC` strokes and the `· Pool` text are `currentColor`, so the component picks up `text-foreground` (or whatever class wraps it).
- The pitch tile around `26` uses the existing `--pitch` / `--pitch-foreground` design tokens (already declared in `app/globals.css`), exposed inside the SVG via inline `style="fill: var(--pitch); color: var(--pitch-foreground)"`.
- The vertical pitch-stripe rule is set to a low-opacity `currentColor` so it works in both themes.

No new CSS variables. No new theme tokens.

**4. Favicon = a condensed version of the logotype.**

The favicon (`app/icon.svg`) is just the `26` tile portion: a small rounded square in pitch green with bold mono "26" centered. At 16×16 the wordmark wouldn't read; the `26` tile does. This keeps the brand legible at every scale.

`app/icon.png` is the same artwork exported to a 32×32 PNG for browsers that don't support SVG favicons (older Safari, some embedded webviews). `app/apple-icon.png` is a 180×180 PNG with the tile centered on a neutral background. Both PNGs are generated once with `sharp` from the SVG source; we commit the PNGs and don't keep the script in the dev pipeline.

**5. Drop the manual `icons` block in `app/layout.tsx`.**

Next 16's file-based icons convention auto-populates `<link rel="icon">` and `<link rel="apple-touch-icon">` from `app/icon.*` and `app/apple-icon.*`. Keeping the manual `metadata.icons` block would conflict; remove it.

**6. OG image rewrite.**

The current OG card is heavy on copy. With a real wordmark, we let the logo do the talking:
- Top-left: large wordmark (no `· Pool` suffix at this scale; the `WC26` mark itself is the brand).
- Center: a short headline (`Predict every match.`) and a one-line subhead.
- Bottom-right: a small `2026` corner stamp.
- Background: same dark radial as today, plus a subtle pitch-stripe band along the bottom.

`next/og` doesn't render arbitrary React components (no Tailwind, no client-side state), so we redraw the wordmark with inline `style` props rather than reusing the `Logotype` React component. That's the cost of the OG renderer's constraints; in exchange we keep the visual identical at the pixel level.

## Risks / Trade-offs

- **Risk**: the wordmark glyphs aren't rendered as text in the OG image (Satori needs the font files to do that); they're SVG paths. → **Mitigation**: hard-code the wordmark geometry in the OG file. It's static — won't drift.
- **Risk**: the `26` tile at 16×16 is too dense to read on busy browser tab favicons. → **Mitigation**: tested with a chunky rounded tile, high contrast (pitch green vs near-white). Acceptable trade-off for keeping a single shape across scales.
- **Risk**: removing `app/favicon.ico` breaks browsers that only check that exact path. → **Mitigation**: Next 16's file-based metadata adds a `<link rel="icon">` pointing at the SVG/PNG automatically. Browsers that ignore the `<link>` and probe `/favicon.ico` directly will 404 — which is fine; they then fall through to the `<link>`-declared icon. If we want to keep the bare-URL probe working, ship a tiny `app/favicon.ico` rebuilt from the new tile. Decision: yes, do that — adds one file and zero ongoing cost.

## Migration Plan

1. Build `components/logotype.tsx`.
2. Wire `Logotype` into nav, footer, hero, and dimensions-aware preview.
3. Replace `app/favicon.ico`, add `app/icon.svg`, `app/icon.png`, `app/apple-icon.png`. Delete the old generic icon if present.
4. Strip the manual `metadata.icons` block in `app/layout.tsx`.
5. Rewrite `app/opengraph-image.tsx` to feature the wordmark.
6. Smoke test in browser tab + share-card previewer.

Rollback: revert the PR. No DB or runtime state.

## Open Questions

None.
