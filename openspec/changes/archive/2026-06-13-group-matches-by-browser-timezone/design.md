## Context

`/matches` is a Server Component (`app/[locale]/(public)/matches/page.tsx`). It loads confirmed matches ordered by `kickoff_at`, then buckets them into day sections:

```ts
const key = utcDateKey(m.kickoff_at); // lib/match-utils.ts → iso.slice(0, 10)
```

The day header date is rendered as `<LocalTime iso={`${day}T00:00:00Z`} format="date" />` and each row time as `<LocalTime iso={match.kickoff_at} format="time" />`. `LocalTime` is a client component that renders a deterministic UTC fallback on the server, then reformats to the visitor's locale/timezone after mount (`toLocaleDateString`/`toLocaleTimeString` with `undefined` locale = browser default).

The mismatch: **grouping** is computed in UTC on the server, but **times** are displayed in the visitor's timezone on the client. A match at 02:00 UTC is grouped under that UTC date but shows (e.g. for America/Los_Angeles, UTC-7/8) as 19:00 the previous day — so it appears under the wrong day header, and the header date itself (`${day}T00:00:00Z` reformatted to local) can render the day before for negative-offset zones.

Constraint: grouping must happen where the data is assembled (server), but the timezone is a client-only fact. We need to get the timezone to the server.

## Goals / Non-Goals

**Goals:**
- Group `/matches` day sections by the visitor's local calendar day, consistent with the times shown in each row and header.
- Keep SSR deterministic (no hydration mismatch) and avoid a visible regroup flash on repeat visits.
- Preserve the existing collapsible day sections and their `localStorage`-persisted per-day collapse state.
- Add no new runtime dependency (use the built-in `Intl` API).

**Non-Goals:**
- Changing how individual times are displayed (`LocalTime` stays as-is).
- A user-facing timezone picker / manual override.
- Reworking grouping on other surfaces (`/my-picks`, match detail) — out of scope for this change.
- Server-side IP geolocation for timezone.

## Decisions

### Decision 1: Carry the timezone to the server via a cookie

The server must know the timezone *before* it renders to group correctly. A cookie is readable in the Server Component via `cookies()` from `next/headers` and is sent on every request, so once set, SSR groups correctly with no client regroup.

- A small client component (mounted on the matches route) reads `Intl.DateTimeFormat().resolvedOptions().timeZone`, and if it differs from the current `tz` cookie value, writes `document.cookie = "tz=…"` and calls `router.refresh()` to re-render the Server Component with the now-known timezone.
- The cookie is a plain, non-`HttpOnly` first-party cookie (client must write it), `SameSite=Lax`, `Path=/`, long-lived (e.g. 1 year). It carries no PII beyond an IANA timezone name.

**Alternatives considered:**
- *Client-side regroup after mount* — server renders UTC groups, client re-buckets. Rejected: causes a layout reflow/flash on every load, fights the `localStorage` collapse keys (keyed by day), and duplicates grouping logic on the client.
- *IP geolocation in middleware* — rejected: imprecise (VPNs, travel), and IANA timezone ≠ geo-IP region; the browser already knows the answer exactly.
- *Custom request header* — not settable by the browser on a normal navigation; cookie is the standard channel.

### Decision 2: `localDateKey(iso, timeZone)` using `Intl.DateTimeFormat` parts

Add a timezone-aware key helper alongside `utcDateKey`:

```ts
// Returns "YYYY-MM-DD" for the given instant *in the given IANA timezone*.
export function localDateKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  // assemble YYYY-MM-DD from parts
}
```

`en-CA` yields ISO-ish `YYYY-MM-DD`, but assembling from `formatToParts` is locale-proof. The key stays a sortable `YYYY-MM-DD` string, so day ordering still falls out of the source `kickoff_at ASC` ordering.

`utcDateKey` is retained as the explicit fallback for when no `tz` cookie is present.

### Decision 3: Fallback to UTC when the timezone is unknown

On first visit there is no `tz` cookie. The server falls back to `utcDateKey` (today's behavior) for a deterministic render; the client component then sets the cookie and `router.refresh()` corrects the grouping. An invalid/garbage cookie value must not throw — wrap the `Intl` call and fall back to UTC if `timeZone` is rejected.

### Decision 4: Derive the day-header date from the local key, not a UTC midnight round-trip

Today the header date is `<LocalTime iso={`${day}T00:00:00Z`} format="date" />` — taking the day key as UTC midnight and reformatting to local, which can shift the displayed day. With a local day key, the header should display *that calendar date* directly (the key already names the visitor's local day), avoiding the round-trip entirely. The day key (`YYYY-MM-DD`) remains the `dayKey` passed to `MatchDaySection`, so the `localStorage` collapse-state keys are stable per local day.

## Risks / Trade-offs

- **Extra render on first visit** (cookie write → `router.refresh()`). → Only the first visit per device/timezone pays it; the refresh is a server round-trip, not a full reload, and the fallback render is already correct content (just possibly the wrong day bucket near midnight). Acceptable.
- **Per-timezone response divergence breaks shared HTTP caching of `/matches`.** → The list is already personalized (auth, picks) and `kickoff_at`-ordered; it is not a statically cached page. Vary by the `tz` cookie is consistent with existing per-user rendering.
- **Garbage/stale cookie value could throw in `Intl`.** → Guard the helper; invalid `timeZone` → UTC fallback. Validate shape before trusting the cookie.
- **Day with matches split across local midnight** now correctly produces two day sections where UTC produced one (or vice versa). → This is the intended correction; per-day counts and the collapse default (`every match final/cancelled`) recompute naturally over the new buckets.
- **No-JS clients never set the cookie** → they keep UTC grouping. Acceptable degradation; times still render via the `<time>` fallback.

## Migration Plan

Pure additive frontend change, no data migration. Deploy ships the helper, the client tz-sync component, and the page wiring together. Rollback is a straight revert — removing the cookie read reverts to UTC grouping with no persisted state to clean up (the `tz` cookie is harmless if left behind).

## Open Questions

- None blocking. Cookie name (`tz`) and lifetime (1 year) are reasonable defaults; revisit only if a future change needs an explicit user-facing timezone override.
