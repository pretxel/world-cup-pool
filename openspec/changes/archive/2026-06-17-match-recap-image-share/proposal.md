## Why

We now render a 90s-anime comic image for a match recap and store it publicly, but
it only shows on the admin detail page. The public match view shows the text recap
only, and nothing lets a fan share the comic. Surfacing the image on the public match
page and adding a social share turns the recap into something fans actually circulate —
free reach for the pool.

## What Changes

- Display the active recap's rendered comic image on the **public** match view
  (`/matches/[id]`), in the existing recap section, when a completed render exists.
- Add a **social share** for the match recap on that page, reusing the existing
  `ShareButtons` component (X / Facebook / native / copy) — it shares the match page
  link. Mirrors the pick/leaderboard/quiz share UX already on the site.
- Wire the page's OpenGraph/Twitter image metadata to the stored comic so the shared
  link **unfurls with the comic as the preview image**.
- No new data, RLS, storage, or external calls: the image, its public bucket, and the
  active-version-only RLS already exist (`match-recap-image-render`). Nothing shows
  when there is no completed render for the active recap.

## Capabilities

### New Capabilities
- `match-recap-image-share`: Public display of a match's active recap comic image and
  its social sharing — rendering the image on the public match view, a share control
  that links to the match page, and OpenGraph/Twitter metadata that previews the comic.

### Modified Capabilities
<!-- None. Builds on match-recap-image-render (image + public bucket + active-only RLS)
     and reuses the existing ShareButtons; no existing requirements change. -->

## Impact

- **Depends on**: `match-recap-image-render` (the stored image + public-read RLS).
- **Code (extended)**: `app/[locale]/(public)/matches/[matchId]/page.tsx` — load the
  active completed render's `storage_path`, render the image in the recap section, add a
  recap `ShareButtons`, and set `openGraph.images`/`twitter.images` to the comic URL in
  `generateMetadata`.
- **i18n**: a `shareRecap` namespace (heading, share text, button labels) + a recap
  image heading/alt under `matchDetail`, in en/es/fr/de.
- **No** migration, no new OG route (the comic is a pre-rendered stored asset, linked
  directly), no new dependencies.
