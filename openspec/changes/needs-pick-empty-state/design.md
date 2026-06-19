## Context

`app/[locale]/(public)/matches/page.tsx` already computes everything this change needs. For signed-in users it derives `picksNeeded = user != null && parsePicksParam(picksParam)` (the active state of the `?picks=needed` toggle) and a `needsPickCount` from the team-filtered set, then builds `filtered` by applying the needs-pick predicate on top of the status filter. The page renders day sections from `filtered`, and when `filtered.length === 0` it renders a single empty-state container (lines 299-316) that branches only two ways:

- `isFiltered` (any of team/status/picks active) → `filterEmptyTitle` / `filterEmptyBody` + a "Clear filters" link to `localePath(locale, "/matches")`.
- otherwise → `emptyTitle` / `emptyBody` (no fixtures seeded), no link.

`isFiltered` is `selectedTeams.length > 0 || statusFilter !== null || picksNeeded`. So when the needs-pick toggle is on and everything is locked/done, the user lands in the generic filtered-empty copy ("No fixtures match your filters. Clear them…") — technically accurate but it reads as a failure and only offers to clear filters. The toggle itself (`components/needs-pick-toggle.tsx`) shows a live count, so a user who clicks it at count 0, or whose remaining picks all lock, hits this dead-end. This change adds a third, more specific branch for that case. No data, count, or component plumbing is missing — only the copy and the branch.

## Goals / Non-Goals

**Goals:**
- When the signed-in needs-pick filter is active and yields zero matches, show an encouraging "all caught up — come back tomorrow" empty state instead of the generic filtered-empty copy.
- Provide a clear way out: a link back to all matches labeled as "view all matches" (not "clear filters").
- Keep the message localized across en/es/fr/de.

**Non-Goals:**
- Changing the toggle component, the needs-pick predicate, or how the count is computed.
- Any change to the team/status filtered-empty state or the no-fixtures-loaded empty state.
- A toast, banner, or scheduling/"tomorrow" computation — the copy is a static, friendly prompt, not a timed feature (that nudge work is QW2, a separate change).
- New components, routes, or schema.

## Decisions

### Decision: Branch inside the existing empty-state block on the needs-pick flag
In the `filtered.length === 0` block, add a first-priority case: when the needs-pick filter is the reason (the toggle is active), render the all-caught-up copy and the "view all matches" link; otherwise fall back to the existing `isFiltered` / no-fixtures branches unchanged. The condition reuses the page's existing `picksNeeded` value (already `user != null && parsePicksParam(...)`), so no new state is introduced.

*Alternative considered:* infer "all caught up" purely from counts (e.g. `needsPickCount === 0`). Rejected — the empty state can also be reached with team/status filters layered on top of needs-pick, and keying off the active filter intent (`picksNeeded`) is clearer and matches how `isFiltered` is already derived.

### Decision: Precedence — needs-pick case wins, but only when it is genuinely the cause
The all-caught-up copy should win over the generic filtered-empty copy when the needs-pick toggle is on. If a team/status filter is *also* active, "all caught up" is still the honest, encouraging read for a signed-in user with the needs-pick toggle engaged, and the link returns them to the unfiltered list — so the needs-pick branch taking precedence is acceptable and keeps the logic simple. The no-fixtures-loaded state (`!isFiltered`) is unaffected because `picksNeeded` implies `isFiltered`.

### Decision: Reuse the existing link, relabel it
The container already renders a `<Link href={localePath(locale, "/matches")}>` for the filtered-empty case. The all-caught-up case uses the same link target (which also clears `?picks=needed`) with a distinct label key (`needsPickEmptyAction`, e.g. "View all matches") so the affordance reads as a positive next step rather than an error recovery.

### Decision: Three new `matches` i18n keys, mirroring the existing empty-state keys
Add `needsPickEmptyTitle`, `needsPickEmptyBody`, and `needsPickEmptyAction` alongside the existing `filterEmptyTitle` / `filterEmptyBody` / `filterClear` keys, translated in all four locale files, so the new branch never falls back to English or a missing-key error.

## Risks / Trade-offs

- **Combined filters edge case** — if a team or status filter is active *and* needs-pick is on, the user sees "all caught up" rather than "no matches for these filters". Trade-off accepted: the link returns them to all matches, and the message is still truthful for a needs-pick user. Keeping a single precedence rule avoids a confusing matrix of empty states.
- **Copy promises "tomorrow"** — fixtures may not literally be daily; the phrasing is an encouraging prompt, not a guarantee. Kept generic and friendly to avoid over-claiming.
- **i18n drift** — adding keys to only `en.json` would break other locales; the tasks require all four files to be updated together.
- **Minimal blast radius** — change is confined to one conditional block plus message files; no behavior changes when the needs-pick filter is off or returns results.
