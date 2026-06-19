## Context

The app is Next.js 16 (App Router, Server Components) with GA wired in `app/layout.tsx`: when `env.gaMeasurementId` is set it injects the gtag loader and an init script that defines the global `gtag()` and runs `gtag('js')` + `gtag('config', ...)`. Both scripts use `strategy="afterInteractive"`, so `window.gtag` exists shortly after hydration on the client and never during SSR. `gaMeasurementId` defaults to a real id (`lib/env.ts:72`), but the scripts are still client-only.

The interactions worth measuring already live in client components or have obvious client edges:
- `prediction-form.tsx` — `"use client"`, submits via a server action inside `startTransition` and shows a success toast on `result.ok`.
- `quiz/answer-card.tsx` — `"use client"`, calls `submitQuizAnswer` and sets `answered` state when `res.ok`.
- `components/share-buttons.tsx` — `"use client"`, generic component with X/Facebook anchors plus native-share and copy buttons; reused by pick sharing and leaderboard-rank sharing.
- The groups join flow — `group-forms.tsx` `JoinGroupForm` and `join/[code]/join-confirm.tsx`, both `"use client"`, use `useActionState(joinGroupAction)`; on success the action `redirect`s to `/groups/{id}`.
- `leaderboard/page.tsx` — a Server Component, so it needs a tiny client child to fire a mount event.

There is no analytics helper today and `window.gtag` is untyped. `global.d.ts` already exists for a global type augmentation, so it is the natural home for the gtag type.

## Goals / Non-Goals

**Goals:**
- One shared, safe way to emit a custom GA event from client code: `trackEvent(name, params?)`.
- Never throw and never break a flow if gtag is missing (no GA id, SSR, ad-blocker) — the helper is a silent no-op.
- Fire the five named events from the real interaction sites, only on success, with a small, consistent set of params.
- Keep `window.gtag` typed so the helper and call sites compile under `tsc --noEmit`.

**Non-Goals:**
- New GA setup, server-side / Measurement Protocol events, email or redirect-based attribution.
- Consent management, cookie banners, or PII in event params.
- Any interaction beyond the five (no `match_detail_view`, `live_feed_view`, onboarding funnel, etc. — those are separate análisis items).
- Changing the existing layout GA scripts.

## Decisions

**1. A single `trackEvent` helper in `lib/analytics.ts`.**
Signature `trackEvent(name: string, params?: Record<string, string | number | boolean>)`. It guards `typeof window !== "undefined" && typeof window.gtag === "function"` and then calls `window.gtag("event", name, params)`. Centralizing the guard means call sites are one line and stay safe; alternatives (calling `gtag` inline at each site, or a `useAnalytics` hook) either duplicate the guard or add ceremony for a fire-and-forget call.

**2. Type `window.gtag` via `global.d.ts`.**
Add `interface Window { gtag?: (...args: unknown[]) => void }` to the existing `declare global` block. This matches how the inline init script defines `gtag` and keeps the helper free of `any`/`@ts-expect-error`. The helper treats `gtag` as optional, mirroring runtime reality.

**3. Fire only on confirmed success.**
- `prediction_submitted`: in the `if (result.ok)` path of `onSubmit`, alongside the existing success toast. Params: `{ match_id }`.
- `quiz_answered`: in the `if (res.ok)` branch where `setAnswered` runs. Params: `{ question_id, correct: res.isCorrect }`.
- `group_joined`: the join action `redirect`s on success, so the client never sees an explicit success return. Fire when the action state transitions to no-error after a submit (i.e. the inverse of the existing `if (state.error)` effect) in `JoinGroupForm` and `JoinConfirmForm`; alternatively fire optimistically on submit. Because the redirect unmounts the form, the success-path-on-state is the robust place. Params: none required (avoid leaking the raw join code).
- `leaderboard_viewed`: fire once on mount from a small client child rendered by the Server Component page. Params: none.
This avoids counting validation failures, out-of-range rejects, or `already-answered` as engagement.

**4. `share_click` carries `platform` + caller `context`.**
`share-buttons.tsx` is generic and reused, so the event must distinguish what was shared. Add an optional `context` prop (e.g. `"pick" | "rank" | "quiz"`) and emit `share_click` with `{ platform, context }` from each affordance: the X and Facebook anchors (in their `onClick`, the navigation still proceeds), the native-share button (in `onNativeShare`), and the copy button (in `onCopy`). The leaderboard page passes `context="rank"`; pick/quiz share call sites pass their own. The prop is optional so existing call sites keep compiling even before they set it.

**5. No batching / no queue.**
Events are fire-and-forget; if gtag is not ready yet the event is dropped. For these coarse engagement counts that is acceptable and far simpler than buffering until gtag loads.

## Risks / Trade-offs

- **gtag not yet loaded at interaction time** → event dropped. Accepted: `afterInteractive` loads early and these interactions require user action after page load; no queue needed for v1.
- **Ad-blockers / no GA id / SSR** → `window.gtag` absent; the guard makes `trackEvent` a no-op, so flows are unaffected and tests (no DOM gtag) don't fail. This is by design.
- **`group_joined` timing** → the success redirect unmounts the form, so firing must happen before navigation or be tolerant of the unmount; chosen approach keys off the action-state success transition. If GA misses the event during the unmount race, the count is a slight undercount, which is acceptable.
- **PII / sensitive params** → only ids and booleans are sent (`match_id`, `question_id`, `correct`, `platform`, `context`); no display names, emails, or raw join codes. Keep it that way.
- **Double-counting** → events fire on the success branch only, and `leaderboard_viewed` fires once per mount (guard with a mount ref if Strict Mode double-invokes effects in dev).
- **Generic component coupling** → adding a `context` prop to `ShareButtons` lightly widens its API; kept optional and string-typed to avoid breaking the two existing call sites.
