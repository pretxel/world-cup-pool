## 1. Fix the invalid export

- [x] 1.1 In `app/[locale]/profile-actions.ts`, remove the `export` keyword from `pushSubscriptionSchema` (Zod object) and `PushSubscriptionInput` (its inferred type) — keep them module-local (verified: no external importers). Leave `updateDisplayName`, `savePushSubscription`, `removePushSubscription` as exported async actions.

## 2. Regression guard

- [x] 2.1 Add a test (e.g. `tests/use-server-exports.test.ts`) that reads every `"use server"` module under `app/**` + `lib/**` and asserts each top-level `export` is `export async function`, `export default async function`, or `export type` — failing on any non-function value export.

## 3. Verification

- [x] 3.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; the new guard test passes and the suite is green.
- [x] 3.2 Manually verify (or via the guard) that `/[locale]/matches/[matchId]` renders and a signed-in user can submit and update a pick without the `invalid-use-server` error.
