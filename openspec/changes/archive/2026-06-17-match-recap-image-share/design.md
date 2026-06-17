## Context

The public match view (`app/[locale]/(public)/matches/[matchId]/page.tsx`) is a server
component using the anon Supabase client. For a final match it already loads the active
recap text (`match_summaries` where `is_active`) and renders it in a recap `<section>`.
It exports `generateMetadata` (OpenGraph `article` + Twitter `summary_large_image`) with
**no image**. It already renders `ShareButtons` for pick sharing, so the share UX is in
place.

The render feature (`match-recap-image-render`) stores the comic in the public
`match-recap-images` bucket and tracks it in `match_summary_images`, whose public SELECT
RLS already restricts rows to the **active** recap version. So the public client can read
the active render directly — no new policy or service-role access needed. The public
object URL is `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/match-recap-images/<path>`.

`ShareButtons` takes `{ shareUrl, shareText, labels: { x, facebook, native, copy, copied } }`
and shares a URL (link), not a file — which is exactly the "link with comic as OG preview"
choice.

## Goals / Non-Goals

**Goals:**
- Show the active recap's completed comic image on the public match page.
- Reuse `ShareButtons` to share the match page link.
- Make the shared link unfurl with the comic via OpenGraph/Twitter image metadata.

**Non-Goals:**
- Sharing the image file directly (Web Share Level 2 / download) — chose link+OG.
- A composited 1200×630 OG card route — link straight to the stored comic.
- Any schema/RLS/bucket change, or showing draft-version images.

## Decisions

### Read the active render with the anon client (RLS does the filtering)
Add one query to the existing final-match block:
`supabase.from("match_summary_images").select("storage_path").eq("match_id", matchId).eq("status","complete").maybeSingle()`.
The active-only RLS guarantees this returns at most the active version's row, so no
`summary_id` join or `is_active` filter is needed in app code. Build the URL with the
same `process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.supabaseUrl` helper the admin page uses.
Render an `<img>` (plain img + eslint-disable, as on the admin page — avoids next/image
remote-pattern config) in the recap section with `alt` naming the teams.

### Direct bucket URL for OG (no new OG route)
The comic is a pre-rendered stored asset, unlike the dynamic pick/rank/quiz OG cards. In
`generateMetadata`, run the same anon query for the active completed render and, if
present, set `openGraph.images` + `twitter.images` to its public URL (keep
`card: "summary_large_image"`). No `/api/og/*` route is added.
Trade-off: the comic is 2:3 portrait, not the 1.91:1 ideal — platforms may letterbox or
center-crop. Accepted; the comic itself is the asset fans want to see. (A future 1200×630
composite OG route is possible if previews look poor — see Open Questions.)

### Reuse ShareButtons; share the match page link
Render a second `ShareButtons` (the page already has one for picks) with
`shareUrl = the canonical match URL` (already computed for metadata / via `env.siteUrl` +
locale path) and recap-flavored `shareText`. Gate it on the image being present, so we
only invite sharing when there's a comic to preview. New `shareRecap` i18n namespace with
`heading` + `shareText` + the five button labels, mirroring `sharePick`.

### generateMetadata + page share one URL builder
Both `generateMetadata` and the component need the active-render lookup; each runs its own
small query (generateMetadata can't read the page body's data). Keep them consistent via a
shared local helper for the public image URL.

## Risks / Trade-offs

- **Portrait OG image may crop on some platforms** → Accepted; deferring a composite
  landscape OG card. The image still previews; the link still works.
- **Extra query in generateMetadata + page** (two reads of the render row) → Negligible;
  single-row indexed lookups, and metadata/body run server-side once per request.
- **Image present but bucket object missing (rare)** → `<img>` simply fails to load; no
  crash. The `status = 'complete'` gate makes this unlikely.

## Migration Plan

1. Extend the public page: load active completed render, render the image, add recap
   `ShareButtons`, set OG/Twitter image in `generateMetadata`.
2. Add `shareRecap` + the recap-image heading/alt strings in en/es/fr/de.
3. No DB/deploy migration; ship with the normal build. Rollback = revert the page/i18n.

## Open Questions

- If social previews crop the portrait comic poorly, add a dedicated `/api/og/recap`
  route that composites the comic into a 1200×630 card (deferred; not needed for v1).
