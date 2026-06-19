## Why

GA is integrated but only loads the base page view: `app/layout.tsx:165-183` injects `gtag('js')` and `gtag('config', '${env.gaMeasurementId}')` and nothing else. A grep confirms there is no `gtag('event', ...)` anywhere in `app/` or `components/`. The product has the very interactions worth measuring — predictions, the daily quiz, share buttons, group joins, the leaderboard — but none of them are instrumented, so the viral and retention funnels are invisible and nothing can be optimized. This is engagement quick win **QW3** from `análisis.md`.

## What Changes

- Add a tiny client-side `trackEvent(name, params?)` helper that safely calls `window.gtag('event', ...)` only when gtag is present (no-op otherwise — gtag is absent when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is unset, and during SSR), and type `window.gtag` so the helper compiles.
- Fire `prediction_submitted` on a successful pick submit in `app/[locale]/(public)/matches/[matchId]/prediction-form.tsx`.
- Fire `quiz_answered` when a quiz answer is accepted in `app/[locale]/(public)/quiz/answer-card.tsx`.
- Fire `share_click` from `components/share-buttons.tsx` (X, Facebook, native, copy), carrying the platform and a caller-supplied `context` (pick / rank / quiz) so the existing pick- and rank-share call sites can be distinguished.
- Fire `group_joined` after a successful join in the groups join flow (`app/[locale]/(app)/groups/group-forms.tsx` `JoinGroupForm` and `app/[locale]/(app)/groups/join/[code]/join-confirm.tsx`).
- Fire `leaderboard_viewed` once when the leaderboard page mounts (`app/[locale]/(public)/leaderboard/page.tsx`), via a small client child since the page itself is a Server Component.

Non-goals: any new GA configuration or property setup, server-side / Measurement Protocol events, email open/click tracking, share-to-signup redirect attribution, consent/cookie banners, dashboards, and instrumenting interactions beyond the five named above.

## Capabilities

### New Capabilities
- `analytics-events`: Client-side custom GA event instrumentation — a safe `trackEvent` helper plus the five key engagement events (prediction submitted, quiz answered, share clicked, group joined, leaderboard viewed) fired from the real interaction sites.

### Modified Capabilities

## Impact

- **Lib**: new helper (e.g. `lib/analytics.ts`) exporting `trackEvent`; `window.gtag` typed via `global.d.ts` (or a local ambient declaration).
- **App / components**: edits to `prediction-form.tsx`, `quiz/answer-card.tsx`, `components/share-buttons.tsx`, the two group-join components, and a small client mount-event child for the leaderboard page.
- **Runtime**: events flow to the existing GA property already configured in `app/layout.tsx`; no schema, env, or infra changes. When GA is not loaded the helper is a silent no-op, so behavior in dev/test/SSR is unchanged.
