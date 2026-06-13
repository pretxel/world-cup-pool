## Why

The current 404 page is text-only — a bare "404 / Offside" headline with two links. It feels unfinished and off-brand for a World Cup pools app, where the not-found moment is a chance to stay playful and on-theme. Adding a football image gives the page visual identity and reinforces the brand without adding another dependency.

## What Changes

- Add a decorative football image to both not-found pages (`app/not-found.tsx` and `app/[locale]/not-found.tsx`).
- Ship the image as a self-hosted SVG asset under `public/` so it works offline, scales crisply, and adds no network/runtime cost.
- Keep existing copy, links, and layout; the image is additive and sits above/around the existing `404` headline.
- Mark the image decorative (empty/aria-hidden alt) so it stays accessible to screen readers — the existing text already conveys the 404 meaning.
- No new i18n strings required (image is decorative); existing `notFound` message keys are unchanged.

## Capabilities

### New Capabilities
- `not-found-page`: Behavior of the application's 404 / not-found page(s), including the decorative football imagery, accessibility treatment, and the existing recovery links.

### Modified Capabilities
<!-- None — no existing spec covers the not-found page. -->

## Impact

- **Code**: `app/not-found.tsx`, `app/[locale]/not-found.tsx`.
- **Assets**: new SVG football image under `public/`.
- **Dependencies**: none (self-hosted SVG, no new packages).
- **i18n**: no new keys; existing `notFound` block in `messages/{en,es,fr}.json` unchanged.
