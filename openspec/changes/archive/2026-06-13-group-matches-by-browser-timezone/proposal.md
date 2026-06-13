## Why

The public `/matches` list groups fixtures into day sections using a **UTC** calendar key (`utcDateKey` = `iso.slice(0, 10)`), but each row and day header renders kickoff in the **visitor's** local time via `LocalTime`. For anyone far from UTC this disagrees: a 19:00 PT kickoff (02:00 UTC next day) lands under the *next* day's header, and the header date itself can read a day off from the times listed beneath it. Grouping must follow the same calendar the visitor reads times in.

## What Changes

- Detect the browser timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) on the client and persist it in a cookie so the server can read it during SSR.
- Group the `/matches` day sections by the visitor's **local** calendar day (in their timezone) instead of by UTC date.
- Render each day header's date from the local day key directly (no `T00:00:00Z` round-trip through `LocalTime`, which can itself shift the displayed day for negative-offset zones).
- First visit / no cookie: fall back to the current UTC grouping for a deterministic SSR render, then set the cookie and `router.refresh()` so the corrected grouping appears without a hydration mismatch or content flash on subsequent renders.
- Keep the collapsible day-section behavior and its `localStorage` per-day keys working against the new local day keys.

## Capabilities

### New Capabilities
- `match-day-grouping`: Rules for which calendar day a match is grouped under on the public list — grouped by the visitor's local timezone day, with a deterministic UTC fallback before the timezone is known, and a stable day-key contract shared by the day header date and the collapse-state storage.

### Modified Capabilities
<!-- No existing spec defines the grouping calendar; match-availability's day-grouping reference is about confirmed-only filtering and is unaffected. -->

## Impact

- `lib/match-utils.ts` — `utcDateKey` gains a timezone-aware sibling (e.g. `localDateKey(iso, timeZone)`); UTC variant retained as the fallback.
- `app/[locale]/(public)/matches/page.tsx` — reads the tz cookie (`next/headers`), keys `byDay` by local day, derives each `dateNode` from the local key.
- `components/match-day-section.tsx` — unchanged behavior; consumes the new day keys.
- New client component to detect timezone, write the cookie, and `router.refresh()` on mismatch (mounted on the matches route).
- `middleware.ts` / cookie plumbing — a new readable cookie (e.g. `tz`); no auth impact.
- No database, API, or dependency changes; no new packages (uses built-in `Intl`).
