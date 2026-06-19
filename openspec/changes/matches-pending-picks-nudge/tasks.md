## 1. Component

- [ ] 1.1 Add `components/pending-picks-nudge.tsx` as a `"use client"` component taking `count: number` and localized strings (banner copy, CTA label, dismiss aria-label)
- [ ] 1.2 Hold a session-scoped `dismissed` state; render nothing once dismissed
- [ ] 1.3 Render the count using the pluralized localized copy, with a CTA and a dismiss control (labeled for assistive tech)
- [ ] 1.4 Wire the CTA to `useQueryParamWriter` to write `{ picks: "needed" }`, matching the write `NeedsPickToggle` performs

## 2. Page integration

- [ ] 2.1 In `app/[locale]/(public)/matches/page.tsx`, render the nudge above the existing filter controls only when `user != null && needsPickCount > 0 && !picksNeeded`
- [ ] 2.2 Pass `needsPickCount` and the localized `matches.*` strings into the nudge; reuse the already-computed count (no new query)

## 3. i18n

- [ ] 3.1 Add the new `matches.*` nudge strings (pluralized count copy, CTA label, dismiss aria-label) to `messages/en.json`
- [ ] 3.2 Mirror the new strings in `messages/de.json`, `messages/es.json`, and `messages/fr.json`

## 4. Verify

- [ ] 4.1 `pnpm typecheck` and `pnpm lint` clean
- [ ] 4.2 `pnpm test` passes
- [ ] 4.3 Signed-in with pending picks: `/matches` shows the banner with the same number as the needs-pick toggle; CTA applies `?picks=needed`; dismiss hides it for the session — runtime check, needs signed-in session
- [ ] 4.4 Signed out and signed-in with `needsPickCount = 0` or with `?picks=needed` already active: no banner, no extra query — runtime check
