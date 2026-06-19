## Why

Submitting a prediction is the emotional peak of the prediction loop — the player has just committed a scoreline and wants it seen. Today nothing happens at that moment beyond a toast (`predictionForm.pickLocked`): the share infrastructure that could turn that peak into organic reach (`ShareButtons`, the `/share/pick/[matchId]` landing, the `/api/og/pick` card) lives only on the match page below the form and on the standalone share landing — never surfaced in the submit flow itself. Quick win QW4 from `análisis.md` closes this gap: prompt sharing the moment a pick is locked in, converting the highest-intent instant into new sign-ins.

## What Changes

- After a successful `submitPrediction` in `PredictionForm`, reveal an inline "Share your pick" CTA with the existing `ShareButtons` (X / Facebook / native / copy) pointing at the player's just-submitted scoreline.
- The share URL is built with the existing `buildPickSharePath(locale, matchId, home, away)` + `env.siteUrl`, and the share text reuses the existing `sharePick.shareText` message — no new share landing, OG route, or share infra.
- The CTA appears only after a successful submit (created or updated pick), reflects the scores just saved, and stays consistent if the user edits and re-submits. It is hidden again when the form re-enters a dirty (unsaved) state so it never advertises a stale scoreline.
- Wire the locale and `env.siteUrl` (or a prebuilt share base) into `PredictionForm` so it can compose an absolute share URL on the client.
- No new user-facing strings are required: the `sharePick` namespace already provides `heading`, `shareText`, `shareOnX`, `shareOnFacebook`, `shareNative`, `copyLink`, and `copied` in en/es/fr.

Non-goals: changing the standalone `/share/pick` landing or the OG card, adding analytics events (tracked separately as QW3), appending "join my pool" copy to the share text, or surfacing sharing for locked/anonymous states.

## Capabilities

### New Capabilities
- `share-pick-after-submit`: surface an inline share CTA in the prediction form immediately after a pick is successfully submitted, reusing the existing pick-share infrastructure.

### Modified Capabilities
<!-- none -->

## Impact

- **Component**: `app/[locale]/(public)/matches/[matchId]/prediction-form.tsx` — after `submitPrediction` succeeds, store the saved scores, render the share CTA + `ShareButtons`; reset the CTA when the form becomes dirty again. Accept `locale` and a share base URL as props.
- **Page**: `app/[locale]/(public)/matches/[matchId]/page.tsx` — pass `locale` and `env.siteUrl` (or a precomputed share base) into the rendered `PredictionForm`.
- **Reused infra**: `components/share-buttons.tsx`, `lib/share.ts` (`buildPickSharePath`), `app/[locale]/(public)/share/pick/[matchId]`, `app/api/og/pick` — consumed unchanged.
- **i18n**: reuses the existing `sharePick.*` messages already present in `messages/{en,es,fr,de}.json`; no new keys required (any new label, if added, must be localized in all four).
- **Data**: none — no schema, query, or RLS change; the share URL is built from values already in the client form state.
