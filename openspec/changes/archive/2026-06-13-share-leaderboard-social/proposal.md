## Why

The pool has a per-pick share loop (`pick-sharing`) but no way to share standings, so the strongest brag — "I'm ranked #3 with 47 points" — never leaves the app. A shareable rank card turns every climbing player into an inbound invite, the same growth loop pick-sharing was built for, applied to the leaderboard where competitive pride is highest.

## What Changes

- Add a share section to the public `/leaderboard` page, shown only to a signed-in viewer who appears in the overall ranking. It offers X, Facebook, native-share (`navigator.share`), and copy-link actions for the viewer's own standing.
- Add a public, `noindex` share landing page `/{locale}/share/rank/{userId}` that renders a rank card (rank, display name, points, exact-hit count, total player count) from URL parameters, with a CTA into `/leaderboard`. It re-derives the rank server-side from `v_leaderboard_overall` so the shared numbers stay truthful even if the URL is stale or tampered.
- Add a dynamic Open Graph image route `/api/og/rank` producing a 1200×630 brag card matching the brand scoreboard styling.
- Add a localized `shareRank` messages namespace (en, es, fr): share text, landing-page copy, button labels, and OG alt text.
- Reuse `lib/share.ts` helpers (X intent, Facebook sharer, clamp) and the existing share-buttons UI pattern rather than duplicating them.

## Capabilities

### New Capabilities
- `leaderboard-sharing`: Social sharing of a player's overall leaderboard standing — the share actions on the leaderboard page, the public rank share landing page rendered from URL parameters and verified against the live ranking, the dynamically generated Open Graph rank card, and the localization of all share copy.

### Modified Capabilities
<!-- None. The leaderboard spec governs scope/data-source/copy of the page itself; adding a viewer-only share section does not change those requirements (still single overall scope, still v_leaderboard_overall, no tz cookie). -->

## Impact

- **New code**: `app/[locale]/(public)/share/rank/[userId]/page.tsx`, `app/api/og/rank/route.tsx`, a `shareRank` block in `messages/{en,es,fr}.json`, and a small share helper (`buildRankSharePath`) in `lib/share.ts`.
- **Modified code**: `app/[locale]/(public)/leaderboard/page.tsx` gains a viewer-only share section; the existing `SharePickButtons` component is generalized or a sibling `ShareRankButtons` added (decided in design).
- **Data**: read-only. Reuses `v_leaderboard_overall`; no schema or migration changes. The OG route uses a cookie-less anon Supabase client like `/api/og/pick`.
- **Dependencies**: none new — `next/og`, `next-intl`, existing Supabase clients.
