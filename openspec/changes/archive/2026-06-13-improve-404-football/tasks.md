## 1. Add the football asset

- [x] 1.1 Create a self-hosted football SVG at `public/football.svg`, theme-agnostic so it reads on light and dark backgrounds
- [x] 1.2 Confirm the SVG has intrinsic width/height so consumers can reserve layout space

## 2. Update the not-found pages

- [x] 2.1 In `app/not-found.tsx`, render the football image above the `404` eyebrow/headline with empty `alt=""` (decorative) and responsive sizing (smaller on mobile, larger at `sm+`)
- [x] 2.2 In `app/[locale]/not-found.tsx`, render the same image with identical markup, decorative alt, and sizing, keeping the localized copy and links intact
- [x] 2.3 Reserve fixed dimensions (width/height classes) on the image to prevent layout shift on load

## 3. Verify

- [x] 3.1 Confirm both pages render the football image with existing copy and both recovery links present
- [x] 3.2 Verify the image is hidden from the accessibility tree (empty alt / `aria-hidden`) while the `404` text is still announced
- [x] 3.3 Confirm the localized page still renders with `en`, `es`, and `fr` using the unchanged `notFound` keys (no new i18n strings)
- [x] 3.4 Run lint/typecheck to confirm no regressions
