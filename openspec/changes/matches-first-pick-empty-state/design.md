## Context

`app/[locale]/(public)/matches/page.tsx` is a server component. It loads all matches, filters to confirmed fixtures (`isConfirmedMatch`), and — for signed-in users only — reads the user's `predictions` into `pickedIds` (a `Set<string>` of picked `match_id`s). It applies ephemeral URL filters (team → status → picks) and computes `isFiltered = selectedTeams.length > 0 || statusFilter !== null || picksNeeded`. It then groups the filtered list by the visitor's local calendar day and renders day sections. The only empty UI is the `filtered.length === 0` block, which shows `emptyTitle`/`emptyBody` (or `filterEmptyTitle`/`filterEmptyBody` + a clear-filters link when `isFiltered`). That block never fires for a new user whose list is full of fixtures.

`lib/match-utils.ts` already holds the pure helpers this page leans on: `isLocked` (final/cancelled/live/past-kickoff), `isConfirmedMatch`, `needsPick(match, pickedIds)` (= not picked AND not locked), and `statusBucket`. A "still pickable" match is exactly one where `!isLocked(match)` and the status is `scheduled` — `needsPick` already encodes the unlocked-and-unpicked notion for a given user.

The fixture source is ordered `kickoff_at ASC`, so the soonest pickable fixture is the first confirmed match that is still open.

## Goals / Non-Goals

**Goals:**
- Cut time-to-first-prediction: when a signed-in user has zero picks and no active filters, show an inviting "Make your first pick" lead state above the list, pointing at the soonest still-pickable match.
- Keep the full fixture list visible below the lead state (it is a nudge, not a takeover).
- Gracefully handle the "no picks but nothing currently pickable" case with encouraging copy, not a dead end.
- Pure, unit-testable selection of the soonest pickable match; localized (en/es/fr/de).

**Non-Goals:**
- No toast/banner of pending picks (that is QW2, `matches-pending-picks-nudge`).
- No change to the needs-pick filter empty state (that is QW9, `needs-pick-empty-state`).
- No analytics events here (QW3 covers instrumentation separately).
- No change to anonymous-visitor rendering, the filters, day grouping, or the existing list-empty states.
- No "today vs soonest" calendar logic beyond picking the earliest open fixture; no per-day highlight.

## Decisions

### Decision: Gate strictly on signed-in + zero picks + no filters
Render the lead state only when `user != null && pickedIds.size === 0 && !isFiltered`. Anonymous visitors never see it (no per-user pick data). Once the user has any pick, the nudge disappears — its job (first pick) is done. Requiring `!isFiltered` keeps it out of the way when the user is deliberately narrowing the list, and avoids competing with the existing filter-empty state.

*Alternative considered:* show it whenever picks are zero regardless of filters — rejected; it would fight the active-filter UX and the `filterEmptyTitle` block.

### Decision: Target the soonest still-pickable match, computed by a pure helper
Add `soonestPickableMatch(matches, pickedIds)` to `lib/match-utils.ts`: over the confirmed, kickoff-ASC list it returns the first match for which `needsPick(match, pickedIds)` is true, else `null`. Because zero picks is the gate, this is effectively "first unlocked scheduled fixture." Returning `null` drives the "nothing pickable" branch. Keeping it pure mirrors the other `match-utils` helpers and makes it unit-testable without a page render.

*Alternative considered:* inline the loop in the page — rejected; the page already imports a cluster of `match-utils` helpers and a named helper is testable and self-documenting.

### Decision: Lead state renders above the day sections, never replacing the list
Place the lead state between the filters and the `<div className="space-y-12">` list block. It is additive: the day sections still render below. This preserves "the list is always there" while adding the nudge. The existing `filtered.length === 0` empty block is untouched and, given the gate, won't coincide with the lead state for a new user (their list is non-empty when a pickable match exists).

### Decision: Two copy branches — CTA vs. encouragement
When `soonestPickableMatch` is non-null, render the eyebrow + "Make your first pick" title + a CTA link to `localePath(locale, /matches/${id})` (same link style the page already uses). When it is `null` (no picks, but every fixture is locked/live/final), render the eyebrow + an encouraging "no open matches right now — check back soon" message and **no** dead CTA. This avoids stranding a brand-new user who arrives between matchdays.

### Decision: New `matches.firstPick` i18n sub-block
Add `firstPick` keys under the existing `matches` namespace (`eyebrow`, `title`, `cta`, `noneTitle`, `noneBody`) in all four locale files, consistent with the namespace's existing key style. No new namespace.

## Risks / Trade-offs

- **Extra nudge surface on an already control-dense header** → it sits below the filters and above the list, styled like the existing dashed empty-state card, so it reads as part of the page rather than an interruption; it only ever shows for a zero-pick, unfiltered, signed-in user.
- **"Soonest pickable" can be empty between matchdays** → handled explicitly by the `null` branch with encouraging copy instead of a broken CTA.
- **Definition drift between "pickable" here and lock logic elsewhere** → the helper reuses `needsPick` (built on `isLocked`), so it can't diverge from the lock/needs-pick rules used by the rest of the page.
- **A returning user who deleted all picks would see it again** → acceptable and rare; the gate is intentionally "zero picks," which is the precise signal for "hasn't made a first pick."
