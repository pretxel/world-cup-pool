## 1. Helper & types

- [x] 1.1 Add `interface Window { gtag?: (...args: unknown[]) => void }` to the `declare global` block in `global.d.ts`
- [x] 1.2 Create `lib/analytics.ts` exporting `trackEvent(name: string, params?: Record<string, string | number | boolean>)` that no-ops unless `typeof window !== "undefined" && typeof window.gtag === "function"`, then calls `window.gtag("event", name, params)`
- [x] 1.3 Add a unit test (e.g. `tests/analytics.test.ts`) covering: gtag present → forwarded with `("event", name, params)`; gtag absent → no-op, no throw

## 2. Prediction submitted

- [x] 2.1 In `app/[locale]/(public)/matches/[matchId]/prediction-form.tsx`, import `trackEvent` and fire `trackEvent("prediction_submitted", { match_id: matchId })` inside the `result.ok` branch of `onSubmit` (next to the success toast)
- [x] 2.2 Confirm no event fires on the validation/out-of-range or `!result.ok` paths

## 3. Quiz answered

- [x] 3.1 In `app/[locale]/(public)/quiz/answer-card.tsx`, import `trackEvent` and fire `trackEvent("quiz_answered", { question_id: questionId, correct: res.isCorrect })` inside the `if (res.ok)` branch where `setAnswered` runs
- [x] 3.2 Confirm no event fires on `already-answered` / `not-signed-in` / `blocked` / generic-error paths

## 4. Share clicked

- [x] 4.1 In `components/share-buttons.tsx`, add an optional `context?: string` prop (e.g. `"pick" | "rank" | "quiz"`)
- [x] 4.2 Fire `trackEvent("share_click", { platform: "x", context })` from the X anchor `onClick` (navigation still proceeds); same for Facebook with `platform: "facebook"`
- [x] 4.3 Fire `trackEvent("share_click", { platform: "native", context })` in `onNativeShare` and `trackEvent("share_click", { platform: "copy", context })` in `onCopy`
- [x] 4.4 Pass `context="rank"` from the leaderboard rank-share call site (`app/[locale]/(public)/leaderboard/page.tsx`); pass the appropriate context from the pick/quiz share call sites that render `ShareButtons`

## 5. Group joined

- [x] 5.1 In `app/[locale]/(app)/groups/group-forms.tsx` (`JoinGroupForm`) and `app/[locale]/(app)/groups/join/[code]/join-confirm.tsx` (`JoinConfirmForm`), fire `trackEvent("group_joined")` on the success transition (action state has no error after a submit), mirroring the existing `if (state.error)` effect
- [x] 5.2 Confirm no event fires when `joinGroupAction` returns `errorInvalidCode` / `errorGeneric`, and that the raw join code is not included in params

## 6. Leaderboard viewed

- [x] 6.1 Add a tiny `"use client"` mount-event child (e.g. `app/[locale]/(public)/leaderboard/leaderboard-view-tracker.tsx`) that calls `trackEvent("leaderboard_viewed")` once in a mount `useEffect` (guard with a ref so a dev Strict-Mode double-mount fires once)
- [x] 6.2 Render that child from the leaderboard Server Component page

## 7. Verify

- [x] 7.1 Run `pnpm typecheck` clean (confirms `window.gtag` typing and call sites)
- [x] 7.2 Run `pnpm lint` clean
- [x] 7.3 Run `pnpm test` (incl. the new analytics helper test) green
- [x] 7.4 Manual: with GA loaded, in the browser GA DebugView / network, confirm each of the five events fires on its interaction and only on success; confirm flows still work with GA blocked (helper no-ops)
