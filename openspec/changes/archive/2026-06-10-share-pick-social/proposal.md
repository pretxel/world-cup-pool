# Proposal: share-pick-social

## Why

Users who submit a prediction have no way to show it off. Pick-sharing is the cheapest growth loop the pool has: a shared pick is both bragging and an invitation, and the tournament window (starting June 11) is when that loop pays. Plain "share this URL" is not enough — Facebook ignores share text entirely (it only renders the URL's Open Graph card) and Instagram has no web share endpoint — so a real implementation needs a shareable page whose OG card shows the pick, plus the native mobile share sheet for Instagram.

## What Changes

- New public share landing page `/{locale}/share/pick/{matchId}?h=<n>&a=<n>` that renders the pick (teams, flags, scores, kickoff) with a "make your own pick" CTA linking to the match, and carries Open Graph / Twitter Card metadata whose image shows the pick.
- New OG image route (`ImageResponse` from `next/og`) that draws the share card: both teams, the predicted score, stage, and branding.
- New `SharePickButtons` client component on the match detail page, visible when the signed-in viewer has a saved prediction: X/Twitter intent link, Facebook sharer link, native share via `navigator.share` (covers Instagram and everything else on mobile), and copy-link fallback when native share is unavailable.
- Localized share text and UI labels (en/es/fr) in a new `sharePick` messages namespace.
- Pick values travel in the URL the user chooses to share; the share page validates and clamps them and never reads other users' prediction rows.

## Capabilities

### New Capabilities

- `pick-sharing`: share-pick buttons on the match detail page, the public share landing page, and its Open Graph card image.

### Modified Capabilities

(none — existing match-presentation and predictions behavior is untouched)

## Impact

- New: `app/[locale]/(public)/share/pick/[matchId]/page.tsx`, OG image route handler, `components/share-pick-buttons.tsx`, share-URL builder in `lib/`.
- Modified: `app/[locale]/(public)/matches/[matchId]/page.tsx` (render share section when `myPrediction` exists), `messages/{en,es,fr}.json`.
- No database or schema changes; no new dependencies (`next/og` ships with Next).
- Share page is public and indexable-noindex (it's parameterized user content, not canonical content).
