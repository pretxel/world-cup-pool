## Context

`PredictionForm` (`app/[locale]/(public)/matches/[matchId]/prediction-form.tsx`) is a `"use client"` component holding `home`/`away` score state and a `submitPrediction` server action call. On success today it only fires a `toast.success(t("pickLocked"))` and clears `touched` — the moment of highest intent ends with no path to share.

The share infrastructure already exists and is reused across the app:
- `ShareButtons` (`components/share-buttons.tsx`) takes `shareUrl`, `shareText`, and a `labels` object (`x`, `facebook`, `native`, `copy`, `copied`) and renders X / Facebook / native-share / copy affordances. It is already consumed by the match page, leaderboard, and quiz pages.
- `buildPickSharePath(locale, matchId, homeGoals, awayGoals)` (`lib/share.ts`) returns the locale-prefixed relative path `/{locale}/share/pick/{matchId}?h=&a=` with goals clamped to 0–20.
- The landing route `app/[locale]/(public)/share/pick/[matchId]/page.tsx` renders the shared scoreline + a "Make your own pick" CTA, and emits OG/Twitter metadata backed by `app/api/og/pick`.
- The `sharePick` i18n namespace already contains `heading`, `shareText` (`"My pick: {home} {h}–{a} {away} · World Cup 2026 Pool"`), `shareOnX`, `shareOnFacebook`, `shareNative`, `copyLink`, and `copied` in all four locales.

The only missing piece is surfacing these inside the submit flow. `PredictionForm` does not currently receive `locale` or a site base URL, and `buildPickSharePath` returns a relative path while `ShareButtons` (and the OG/X/Facebook intents) need an absolute URL.

## Goals / Non-Goals

**Goals:**
- Reveal an inline "Share your pick" CTA the instant `submitPrediction` returns `ok: true`, reflecting the exact scores just saved.
- Reuse `ShareButtons`, `buildPickSharePath`, the `/share/pick` landing, the `/api/og/pick` card, and the existing `sharePick.*` messages — zero new share infra and (ideally) zero new strings.
- Keep the CTA truthful: it appears only after a successful save and is hidden whenever the form returns to a dirty/unsaved state so it never advertises a stale scoreline.

**Non-Goals:**
- Any change to the standalone `/share/pick` landing page or the `/api/og/pick` card.
- Analytics/GA events on share clicks (covered separately by QW3 / the `analytics-events` change).
- Appending "join my pool" or referral copy to the share text (a separate viral-loop lever).
- Showing sharing for locked, final, anonymous, or admin states — the CTA only exists where the editable form renders.

## Decisions

**1. Track the last successfully-saved scores in form state.**
Add a `sharedPick` state (e.g. `{ home: number; away: number } | null`, default `null`). On `submitPrediction` success set it to the submitted `{ home, away }` alongside the existing `toast.success` and `setTouched(false)`. Render the share block only when `sharedPick` is non-null. This decouples the CTA from the live steppers so editing the form without re-submitting never changes what would be shared.

**2. Hide the CTA when the form goes dirty again.**
When the user changes a stepper after sharing (the form becomes dirty / `touched`), clear `sharedPick` so the stale share card disappears until they re-submit. This keeps the advertised scoreline in sync with what is actually saved. Re-submitting repopulates `sharedPick` with the new scores.

**3. Build the absolute share URL on the client from props.**
`buildPickSharePath` returns a relative locale path; the share intents and OG need an absolute URL. Pass `locale` and a `shareBaseUrl` (the page passes `env.siteUrl`) into `PredictionForm`, then compose `shareUrl = \`${shareBaseUrl}${buildPickSharePath(locale, matchId, sharedPick.home, sharedPick.away)}\``. Threading `env.siteUrl` from the Server Component avoids relying on `window.location` and matches how the match page already builds absolute share URLs for the recap `ShareButtons`.

Alternative considered: read the locale via `useLocale()` from next-intl instead of a prop. Acceptable, but passing it explicitly keeps the component's inputs obvious and consistent with `shareBaseUrl`, which must come from the server regardless.

**4. Reuse `sharePick.*` messages verbatim.**
Compose the `ShareButtons` `labels` from `sharePick.shareOnX/shareOnFacebook/shareNative/copyLink/copied` and `shareText` from `sharePick.shareText` with `{ home: homeTeam, away: awayTeam, h: sharedPick.home, a: sharedPick.away }`, and use `sharePick.heading` for the CTA heading — identical to how the match page wires `ShareButtons`. No new i18n keys; if a distinct prompt label is later wanted it must be added to all four locales.

## Risks / Trade-offs

- **Stale share URL after an edit** → Mitigated by Decision 2: the CTA is cleared the moment the form goes dirty and only reappears after a fresh successful submit, so the shared scores always match the saved pick.
- **Absolute URL correctness** → The URL is built from server-provided `env.siteUrl` (same source the recap share already uses), avoiding `window.location` pitfalls in SSR/hydration and across locales.
- **Visual crowding under the form** → The share block renders below the form's footer only after submit; it is additive and disappears on edit, so the default (pre-submit) layout is unchanged.
- **No analytics yet** → Share clicks from this surface won't be measured until QW3 lands; acceptable, as instrumentation is intentionally scoped to the separate `analytics-events` change.
