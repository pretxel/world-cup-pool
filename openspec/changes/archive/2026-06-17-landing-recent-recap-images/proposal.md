## Why

We now generate a shareable 90s-anime comic for each finished match, but they only
appear on individual match pages. Surfacing the most recent ones on the landing page
turns them into a living showcase — eye-catching proof the product is active, and a
direct path into recent matches.

## What Changes

- Add a "recent recap comics" gallery section to the landing page (`app/[locale]/page.tsx`):
  a responsive grid of the most recently generated recap images, newest first, each
  thumbnail linking to its match page (`/matches/[id]`) with team-named alt text.
- The section loads the latest active, completed renders (bounded count, e.g. 8) via
  the anon client; the existing active-only RLS already scopes visibility, so only
  published recap images appear. The section renders nothing when there are none.
- No new data, RLS, storage, or dependencies: reuses `match_summary_images`, the public
  `match-recap-images` bucket, and the existing public-URL pattern.

## Capabilities

### New Capabilities
- `landing-recent-recap-images`: A landing-page gallery of the most recently generated
  match recap comic images, each linking to its match, sourced from the active completed
  renders with public visibility, and hidden when none exist.

### Modified Capabilities
<!-- None. Builds on match-recap-image-render (the stored image + active-only RLS) and
     adds a new landing section; no existing requirements change. -->

## Impact

- **Depends on**: `match-recap-image-render` (stored images + public-read RLS).
- **Code (new)**: `components/recent-recap-images.tsx` — an async server component that
  queries recent completed renders (embedding `matches` for team names) and renders the
  gallery; mounted in `app/[locale]/page.tsx`.
- **i18n**: gallery strings (eyebrow, headline, optional subcopy, image alt) added to the
  `home` namespace in en/es/fr/de.
- **No** migration, no new OG route, no new dependency.
