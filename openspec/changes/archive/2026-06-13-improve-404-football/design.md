## Context

The app has two not-found entry points:
- `app/not-found.tsx` — root fallback, English copy hardcoded.
- `app/[locale]/not-found.tsx` — localized, pulls the `notFound` block from `messages/{en,es,fr}.json`.

Both share the same layout: a `font-mono` eyebrow, a large `404` headline (`font-heading`, condensed), a one-line body, and two recovery links (`Back home`, `Browse matches`) built from `buttonVariants()`. There is no imagery — `public/` holds only utility SVGs and country flags, no football art. The task is to add on-theme football imagery while preserving copy, links, and accessibility.

## Goals / Non-Goals

**Goals:**
- Add a decorative football image to both not-found pages.
- Keep the asset self-hosted, dependency-free, and crisp at any size.
- Preserve existing copy, links, layout proportions, and accessibility semantics.
- Keep both pages visually consistent with each other.

**Non-Goals:**
- No new i18n strings, no copy rewrites.
- No animation requirement (a tasteful CSS-only touch is optional, not mandated).
- No redesign of the recovery links or overall page structure.
- No raster/photographic asset and no external image service.

## Decisions

**Decision: Ship an inline SVG football, not a raster or remote image.**
- Rationale: SVG scales without blur, has tiny payload, needs no `next/image` loader config or network fetch, and inherits theme colors via `currentColor` if desired. A self-hosted `public/football.svg` keeps it dependency-free.
- Alternatives considered: (a) PNG/WebP via `next/image` — heavier, needs sizing/loader care, blurs when scaled; (b) emoji `⚽` — renders inconsistently across platforms and looks unpolished; (c) remote/CDN image — adds a network dependency and a failure mode for an error page that must always render.

**Decision: Render the image as decorative (aria-hidden / empty alt).**
- Rationale: The visible `404` headline and body already convey meaning to assistive tech. A decorative football adds no information, so it should be hidden from the accessibility tree to avoid redundant announcements.
- Alternatives considered: descriptive alt text — would force a translated string per locale for zero informational gain.

**Decision: Place the image above the eyebrow/headline, sized responsively.**
- Rationale: Keeps the existing centered column intact; the image becomes the visual anchor at the top of the stack and the text reads beneath it. Responsive sizing (smaller on mobile, larger on `sm+`) matches the existing `text-6xl`/`sm:text-7xl` scale pattern.

**Decision: Apply the same image + markup to both pages.**
- Rationale: The two pages already mirror each other; duplicating the small image markup keeps them consistent and avoids introducing a shared component for ~10 lines. If a shared component is later warranted it can be extracted without spec change.

## Risks / Trade-offs

- [Decorative image announced by screen readers if alt is omitted incorrectly] → Set `alt=""` (or `aria-hidden`) explicitly and verify the accessibility tree shows no image node.
- [Image clashes with dark/light theme] → Use a theme-agnostic palette or `currentColor`/muted tokens so it reads on both backgrounds.
- [Markup duplication across the two pages drifts over time] → Keep markup identical and minimal; revisit extraction only if a third consumer appears.
- [Layout shift from image load] → Inline SVG / fixed dimensions avoid reflow; reserve box size via width/height classes.

## Migration Plan

Additive change, no migration. Deploy ships the new `public/` asset and the two edited pages. Rollback = revert the two files and remove the asset; no data or schema involved.
