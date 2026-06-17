## 1. Data + image display

- [x] 1.1 In `app/[locale]/(public)/matches/[matchId]/page.tsx`, inside the existing final-match block, query the active completed render: `supabase.from("match_summary_images").select("storage_path").eq("match_id", matchId).eq("status", "complete").maybeSingle()` (active-only RLS handles version scoping); compute the public URL via `process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.supabaseUrl` + `/storage/v1/object/public/match-recap-images/<path>`
- [x] 1.2 Render the comic `<img>` in the recap section when present, with `alt` naming the teams (plain img + eslint-disable, mirroring the admin page); responsive, rounded, bounded height

## 2. Social share

- [x] 2.1 Add a `shareRecap` namespace (heading, shareText with {home}/{away}, shareOnX, shareOnFacebook, shareNative, copyLink, copied) to messages/en|es|fr|de.json, plus a recap-image heading/alt under `matchDetail`
- [x] 2.2 Render a `ShareButtons` for the recap when the image is present: `shareUrl` = canonical match page URL, `shareText` = `shareRecap.shareText` with team names, `labels` from `shareRecap`

## 3. OpenGraph / Twitter preview

- [x] 3.1 In `generateMetadata`, run the same active-completed-render lookup; when present, set `openGraph.images` + `twitter.images` to the comic public URL (keep `twitter.card = "summary_large_image"`); when absent, leave metadata unchanged (no image)
- [x] 3.2 Factor the public-image-URL construction into a shared local helper used by both `generateMetadata` and the page body

## 4. Verification

- [x] 4.1 Run `pnpm lint` + `pnpm typecheck` + test suite
- [x] 4.2 Verify on a final match with a completed render: image shows on the public page; share buttons share the match link; the link unfurls with the comic (validate OG/Twitter tags); and a match with no render shows no image and unchanged metadata
