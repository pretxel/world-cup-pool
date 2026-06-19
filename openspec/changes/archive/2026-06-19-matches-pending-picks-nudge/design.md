## Context

`/matches` (`app/[locale]/(public)/matches/page.tsx`) is a Server Component that, for signed-in users, already resolves the user via `supabase.auth.getUser()`, fetches their predicted `match_id`s, and computes `needsPickCount` from the team-filtered set using `needsPick(m, pickedIds)` (`lib/match-utils.ts`). That count today only feeds the `NeedsPickToggle` (`components/needs-pick-toggle.tsx`), a pill that the user must notice and click; the active state lives in the URL as `?picks=needed` (`parsePicksParam`). Nothing proactively tells the user picks are pending — that nudge is deferred to the daily UTC reminder email, which is decoupled from the moment of use. This change surfaces the same count as a dismissible banner at the top of the page, with a CTA into the existing filter.

## Goals / Non-Goals

**Goals:**
- Surface `needsPickCount` proactively as a dismissible top-of-page banner for signed-in users when it is greater than zero.
- Give the banner a CTA that activates the existing `?picks=needed` filter — no new filtering logic.
- Reuse the already-computed count and per-user read; add zero new queries.
- Let the user dismiss the banner so it nudges once without nagging.

**Non-Goals:**
- Push/browser notifications or any change to the email reminder or its cron.
- Timezone-aware or activity-based nudge timing.
- A "locks in N minutes" badge or any change to lock/scoring.
- Persisting dismissal server-side or across sessions/devices.
- Touching the empty-state copy or the `NeedsPickToggle` behavior.

## Decisions

**1. Render the banner in the page Server Component, gated on existing state.**
Place the banner above the existing filter controls and below the header. Render it only when `user != null && needsPickCount > 0 && !picksNeeded` (suppress when the needs-pick filter is already active, since the list is already showing exactly those fixtures). Anonymous requests already skip the predictions read, so the banner never renders for them and costs nothing extra.

**2. Dismiss state lives in a small client component.**
Add `components/pending-picks-nudge.tsx` (`"use client"`) that takes the `count` and localized strings, holds a `dismissed` state (`useState`), and renders nothing once dismissed. The CTA reuses `useQueryParamWriter` to write `{ picks: "needed" }` — the same write `NeedsPickToggle` performs — so the banner and the toggle drive identical URL state. Dismissal is client-only for the session; no persistence is in scope. Alternative considered: a plain `<Link>` to `?picks=needed`. Rejected so the CTA matches the toggle's exact param-write behavior and keeps the filter state consistent.

**3. Reuse `needsPickCount`; no new data path.**
The banner consumes the value the page already computes from the team-filtered set, so the badge/count and the filter result stay in agreement (clicking the CTA can never yield an empty list). No new Supabase query, schema, or RLS change.

**4. Pluralized, localized copy.**
Add `matches.*` strings (e.g. a pluralized count message, a CTA label, and a dismiss aria-label) to all four locales `messages/{de,en,es,fr}.json`, using the existing ICU plural style already present in this namespace (`matchCount`).

## Risks / Trade-offs

- **Banner feels like nagging on every visit** → Mitigation: it is dismissible within the session and is suppressed once `needsPickCount` hits 0 or the filter is active.
- **Dismissal does not persist across reloads/sessions** → Accepted: session-scoped client state keeps scope small for a quick win; a stored preference can follow later if needed.
- **Visual stacking with the existing status/team filters and toggle** → Mitigation: place the banner as a distinct full-width block above the filter row, consistent with current page chrome; it does not replace the `NeedsPickToggle`.
- **Count drift after submitting a pick elsewhere** → The page is a Server Component; a refresh/navigation recomputes `needsPickCount`, matching how the existing toggle count already behaves.
