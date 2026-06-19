## Context

The public matches list (`app/[locale]/(public)/matches/page.tsx`) renders each fixture through the inline `MatchRowCard`, a server component that wraps the row in a `<Link>`. The page already computes per-row state: `uiStatusFor(m)` maps a `MatchRow` to `"scheduled" | "locked" | "live" | "final" | "cancelled"` (using `isLocked` from `lib/match-utils.ts`), and the per-user `picked` boolean comes from the predictions lookup. The trailing right-hand column already branches on this: final score, "on now" (live), "Locked", or the static "Pick" label.

Locking is time-based: `lockReason` in `lib/match-utils.ts` returns `"kickoff"` once `new Date(kickoff_at).getTime() <= Date.now()`, and the prediction form / server action enforce the same boundary. So a `"scheduled"` row in the list is, by definition, still pickable — but a row whose kickoff is 90 seconds away looks identical to one kicking off in three days. The server render is a single point-in-time snapshot; it cannot tick toward the lock.

A client countdown already exists: `components/kickoff-countdown.tsx` is a `"use client"` component that ticks every second from `Date.now()`, formats the remaining time, and renders a `lockedNode`/`lockedLabel` once the target passes. It is already used on the match detail page and prediction form. This change surfaces the same closing-soon awareness in the list, scoped to rows that are open *and* imminent, so the urgency signal appears exactly where the decision is made — without changing the lock rules, the data fetch, or any other row state.

## Goals / Non-Goals

**Goals:**
- On `/matches`, give still-pickable rows whose kickoff is within a short fixed lead window a live "closes in mm:ss" countdown badge and subtle urgency styling, so the closing window is visible while scanning the list.
- Drive the badge from the client clock (second resolution) so it counts down in the visitor's real time and transitions to the locked state at kickoff without a reload, reusing the existing `KickoffCountdown` tick/lock logic.
- Keep the urgency state strictly additive: only an open (scheduled, unlocked) and imminent row changes; every other row state is untouched.
- Localize the new copy across en/es/fr/de.

**Non-Goals:**
- A page-level or global toast/notification. `análisis.md` frames M1 as "badge + toast"; the in-app pending-picks banner (`components/pending-picks-nudge.tsx`, QW2) already covers the top-of-page nudge, so this change delivers the per-row badge and styling and leaves any separate toast to that work. (Recorded as a trade-off below.)
- Changing the lock rules, the kickoff boundary, or adding a grace period — lock still happens exactly at `kickoff_at`.
- Server-pushed updates, polling, Supabase Realtime, or a cron — the only live element is the client-side countdown tick that already exists.
- A new data fetch or schema change — `kickoff_at` and `status` are already on every `MatchRow`.
- Applying urgency to live, locked, final, cancelled, or already-picked rows.

## Decisions

### Decision: "Imminent" is a fixed client-evaluated lead window (≤5 minutes), gated to open rows
A row enters the urgency state only when `uiStatus === "scheduled"` (so it is unlocked and pickable) **and** the time to kickoff is within a fixed lead window — 5 minutes, matching the "se cierra en 5 min" copy in `análisis.md` M1. Because "within 5 minutes" is time-relative and the server render is a snapshot, the badge component must decide on the client: it mounts for scheduled rows, and shows the urgency badge only while `0 < (kickoff − now) ≤ leadWindow`, falling back to the plain "Pick" label otherwise. The lead window is a single named constant so it can be tuned without touching markup.

*Alternative considered:* compute "imminent" on the server from the request time and pass a boolean. Rejected — a row 5m1s out at render time would never update to the urgent state as the seconds tick, and a row already inside the window would still show a stale server-computed remaining time. The client-tick approach keeps the badge honest and lets it cross both the "enter urgency" and "lock" boundaries live.

### Decision: Reuse the existing `KickoffCountdown` tick/lock logic
The badge reuses `components/kickoff-countdown.tsx`'s established pattern: a 1s interval over `kickoff_at`, second-resolution `mm:ss` formatting, and a `lockedNode` swap at `remaining <= 0`. Whether this is a new prop/variant on `KickoffCountdown` or a thin sibling client component built on the same logic is an implementation choice; either way the at-kickoff transition (badge → "Locked") and the formatting come from one place, so the list and detail page can't drift. The component stays the only client island in the row; the rest of `MatchRowCard` remains server-rendered.

### Decision: Replace only the trailing "Pick" affordance, add subtle row styling
For an imminent open row, the right-hand "Pick" label is replaced by the countdown badge ("closes in 4:32"); the row also gets subtle urgency styling (e.g. an accent ring/tint) that is clearly distinct from the live `live-pulse` treatment and the locked muted treatment. All other columns (time, stage badge, teams, venue, chevron) are unchanged. Styling stays within the existing Tailwind token vocabulary used in the row.

### Decision: At kickoff, the badge resolves to the existing locked label
When the countdown hits zero on the client, the badge swaps to the locked label (reusing the existing `rowLocked` copy / `lockedNode`), matching what a fresh server render would show once `isLocked` flips. No reload or refetch is required for the row to reflect the lock; the server snapshot and the client end-state converge.

### Decision: New `matches` i18n keys, translated in all four locales
Add keys such as `rowClosesIn` (e.g. "closes in {time}") and, if needed, `rowClosingSoon` for an accessible label, alongside the existing `rowPick` / `rowLocked` keys, in `messages/{en,es,fr,de}.json`, so the badge never falls back to English or a missing-key error. The countdown's numeric `mm:ss` is interpolated into the localized phrase.

## Risks / Trade-offs

- **No separate toast in this change** — `análisis.md` M1 names "badge + toast". The per-row badge is the higher-signal, lower-noise half and the top-of-page pending-picks banner (QW2) already nudges; a global toast is deferred. Trade-off accepted to keep the blast radius to the row and avoid duplicate nudges.
- **Client/server snapshot divergence at the boundary** — a row rendered as `scheduled` on the server may already be past kickoff by the time the client mounts; the countdown component must clamp to the locked state when `remaining <= 0` so it never shows a negative or stale "closes in". This is already how `KickoffCountdown` behaves.
- **No DB migration, cron, or Supabase Realtime** — explicitly none. The only "live" behavior is the existing client-side 1s interval; nothing is pushed from the server and no new query is issued.
- **Hydration / per-second re-render cost** — only imminent scheduled rows mount a ticking island, and at most a handful of fixtures are within a 5-minute window at once, so the per-second re-render footprint is negligible. Non-imminent and non-scheduled rows render no client island.
- **i18n drift** — adding keys to only `en.json` would break other locales; the tasks require all four files updated together.
- **Lead window choice** — 5 minutes mirrors the analysis copy but is a single constant; if it proves too short/long it can be tuned without markup changes.
