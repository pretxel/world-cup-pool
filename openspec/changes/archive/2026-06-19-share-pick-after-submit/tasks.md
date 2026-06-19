## 1. Wire share inputs into the prediction form

- [x] 1.1 Add `locale: Locale` and `shareBaseUrl: string` props to `PredictionForm` in `app/[locale]/(public)/matches/[matchId]/prediction-form.tsx`.
- [x] 1.2 In `app/[locale]/(public)/matches/[matchId]/page.tsx`, pass `locale` and `env.siteUrl` (the share base) into the rendered `PredictionForm`.

## 2. Track the last successfully-saved scoreline

- [x] 2.1 Add `sharedPick` state (`{ home: number; away: number } | null`, default `null`) to `PredictionForm`.
- [x] 2.2 On `submitPrediction` success, set `sharedPick` to the submitted `{ home, away }` alongside the existing `toast.success(t("pickLocked"))` and `setTouched(false)`.
- [x] 2.3 Clear `sharedPick` (set to `null`) when a score stepper changes after a share, so the form goes dirty and hides the stale CTA until re-submit.

## 3. Render the inline share CTA

- [x] 3.1 When `sharedPick` is non-null, render a "Share your pick" block below the form footer using `sharePick.heading` for the heading.
- [x] 3.2 Compose the absolute share URL: `shareBaseUrl + buildPickSharePath(locale, matchId, sharedPick.home, sharedPick.away)` (import `buildPickSharePath` from `@/lib/share`).
- [x] 3.3 Render `ShareButtons` with that `shareUrl`, `shareText` from `sharePick.shareText` filled with `{ home: homeTeam, away: awayTeam, h: sharedPick.home, a: sharedPick.away }`, and `labels` from `sharePick.shareOnX/shareOnFacebook/shareNative/copyLink/copied`.

## 4. Verification

- [x] 4.1 Run typecheck (`pnpm tsc --noEmit` or the repo's typecheck script) and confirm no errors.
- [x] 4.2 Run lint (`pnpm lint`) and confirm no new violations.
- [x] 4.3 Run the test suite and confirm it passes.
- [x] 4.4 Manual check: submit a new pick (e.g. 2–1) for an unlocked match → the "Share your pick" CTA appears with the correct absolute `/share/pick/{matchId}?h=2&a=1` URL and matching text; edit a score → CTA hides; re-submit → CTA reappears with the new scoreline; copy link opens the share landing showing the saved scoreline and OG card.
- [x] 4.5 Run `openspec validate "share-pick-after-submit"` and confirm it reports valid.
