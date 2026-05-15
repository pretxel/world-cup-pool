## 1. Logotype component

- [x] 1.1 Create `components/logotype.tsx` exporting `Logotype` — a server component rendering inline SVG with `viewBox="0 0 240 64"`. Three `size` variants (`xs` ≈ 24px high, `md` ≈ 44px high, `xl` ≈ 96px high). Uses `currentColor` for the `WC` glyph and the `· Pool` suffix; `--pitch` / `--pitch-foreground` design tokens for the `26` tile.
- [x] 1.2 Compact form: `size="xs"` drops the `· Pool` suffix and narrows the viewBox so the component reads cleanly at small sizes.
- [x] 1.3 Accept a `className` prop so callers can size/color overrides. Set `aria-hidden="true"` by default; expose `aria-label` for the rare case where the logo is the only label.

## 2. Wire into existing surfaces

- [x] 2.1 `components/site-nav.tsx`: replace the hand-rolled `26` tile + literal "WC26" `<span>` + mono `Pool` chip with `<Logotype size="xs" />` inside the brand `<Link>`.
- [x] 2.2 Same file's `SiteFooter`: replace the small `26` tile + `WC26 Pool · 11 Jun – 19 Jul 2026` string with `<Logotype size="xs" />` followed by the date range as separate text (date stays in the existing `footer.tournament` translation key).
- [x] 2.3 `app/[locale]/page.tsx` hero: add `<Logotype size="xl" />` accent next to (or replacing) the `TrophyMark`. Decide visually which feels better and commit to one — keep the hero readable. **(Replaced `TrophyMark` with `Logotype size="xl"` above the headline.)**

## 3. Favicon assets

- [x] 3.1 Create `app/icon.svg` — the `26` tile alone, scaled to fit a square canvas with safe margins. Bold, high contrast, two-color (pitch green + near-white).
- [x] 3.2 Generate `app/icon.png` (32×32) and `app/apple-icon.png` (180×180) from the SVG via a one-shot `sharp` invocation. Committed PNGs; rasterizer kept at `scripts/build-icons.mjs` for future regen.
- [x] 3.3 Regenerate `app/favicon.ico` from the SVG (16+32+48 multi-resolution) so bare-URL `/favicon.ico` probes succeed.
- [x] 3.4 Remove the manual `icons: { … }` block from `app/layout.tsx`'s `metadata` export.

## 4. OG image rewrite

- [x] 4.1 Rewrite `app/opengraph-image.tsx` so the WC26 wordmark is the top-left anchor (hand-coded inline-style geometry — `next/og` can't import the React component). Short headline below; pitch-stripe band along the bottom; `2026` corner stamp.

## 5. Tests

- [x] 5.1 `tests/logotype.test.ts`: render `<Logotype />` at each of `xs`, `md`, `xl` via `react-dom/server`'s `renderToString`; assert each output contains exactly one `<svg>` and a non-empty `viewBox` attribute. Plus: compact-vs-full POOL suffix.
- [x] 5.2 `pnpm test` — all green. **37/37 pass.**

## 6. Verification

- [x] 6.1 `pnpm typecheck` — zero errors.
- [x] 6.2 `pnpm lint` — zero errors.
- [x] 6.3 `openspec validate brand-logotype-and-favicon` — valid.
- [ ] 6.4 `pnpm dev` — visually verify the wordmark across `/en`, `/es`, `/fr` (nav, footer, hero). Check the browser tab favicon updates.
- [ ] 6.5 Fetch `/opengraph-image` (or its rewritten route) in a browser and confirm the new card renders.
