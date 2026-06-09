# Match Status and Needs-Pick Filters

## Why

The `/matches` page filters by team only. Users can't narrow the 100+ match schedule to what's actionable: matches still open for picks, matches live right now, or finished results. For a pools app the highest-value question — "which matches do I still need to pick before they lock?" — has no answer in the UI. Additionally, the header stats (open/live/final) silently omit locked-but-not-live matches, so the buckets don't sum to the total on match days.

## What Changes

- Add a **status filter** (single-select: upcoming / live / final) driven by a `?status=` URL param, surfaced by making the existing header stat cards clickable toggles.
- Rebucket header stats: "open" becomes **"upcoming" = scheduled + locked**, fixing the gap where locked-not-live matches counted nowhere. Row badges continue to distinguish locked from open.
- Add a **"needs my pick" toggle** (signed-in users only) driven by a `?picks=needed` URL param, showing matches that are unpicked AND still open for picks, with a count badge.
- All new params compose with the existing `?team=` filter (AND across dimensions, OR within), are read server-side, and drop unknown values exactly like the team param.
- Generalize the filter-aware empty state and clear-filter affordance to cover the new dimensions.
- New UI strings added to the `matches` i18n namespace in all supported locales (en, es, fr).
- **Deferred (out of scope):** stage filter — near-zero value while knockout fixtures are hidden until team confirmation.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `match-team-filter`: gains status-filter and needs-pick-filter requirements; the "Header stats and day counts reflect the filtered set" requirement changes (stats become interactive filter controls and the upcoming bucket absorbs locked matches); the filter-aware empty state requirement generalizes from team-only to any active filter.

## Impact

- `app/[locale]/(public)/matches/page.tsx` — read/validate new params, compute buckets, pass filter state down.
- `components/match-team-filter.tsx` or new sibling component — interactive stat cards, needs-pick toggle (same URL-writing pattern).
- `lib/match-utils.ts` — param parsing/reconciling helpers for status and picks.
- `messages/en.json`, `es.json`, `fr.json` — new `matches` namespace keys.
- No database, API, or sync changes; `pickedIds` query already exists for signed-in users.
