## Context

`"use server"` modules are server-action entrypoints: React/Next requires every export to be an async function (they become callable RPC endpoints). The push-notifications change put a Zod schema (`pushSubscriptionSchema`) and its inferred type (`PushSubscriptionInput`) as `export`s in `app/[locale]/profile-actions.ts`, which already had the directive. Next.js surfaces this only at runtime (`A "use server" file can only export async functions, found object`), so typecheck/test/build all passed and it shipped.

The blast radius is wide: `components/site-nav.tsx` renders `UserMenu`, which imports `updateDisplayName` from this module; `SiteNav` is in the root layout, so the broken module is pulled into essentially every authenticated page — including the match detail page that hosts `PredictionForm`. The user perceives it as "update my pick errors".

Both offending exports are referenced only inside `profile-actions.ts` (`pushSubscriptionSchema` at the parse site; `PushSubscriptionInput` as the action param type) — verified by grep, no external importers.

## Goals / Non-Goals

**Goals:**
- Restore pick submit/update by making `profile-actions.ts` export only async functions.
- Prevent regression with a cheap guard.

**Non-Goals:**
- Reworking the push subscribe flow or schema shape (only its export visibility changes).
- Touching the prediction RLS/upsert path (verified correct — not the cause).

## Decisions

### Decision: Un-export the schema/type (don't relocate)
Drop the `export` keyword from `pushSubscriptionSchema` and `PushSubscriptionInput`; they stay module-local where their only users are. Minimal, zero behavior change. Relocating to a shared `lib/` module is unnecessary (no external consumer) and would add churn.

*Alternative considered:* move the schema to `lib/push.ts` and import it back — rejected as needless indirection for an internal value.

### Decision: Guard test against non-async `"use server"` exports
Add a unit test that scans `**/actions.ts` + `profile-actions.ts` for `"use server"` and asserts every top-level `export` is `export async function` or `export type` — catching this class of bug before runtime/deploy (typecheck does not).

## Risks / Trade-offs

- **[Other `"use server"` files have the same latent bug]** → the guard test scans them all; a sweep confirmed only `profile-actions.ts` is currently affected.
- **[Hotfix urgency vs. process]** → the change is a two-line edit; fast to apply and verify. It is already broken in prod, so shipping promptly matters.

## Migration Plan

Code-only edit; no DB/migration. Deploy restores the nav + pick flow. Rollback = re-add `export` (not desired).
