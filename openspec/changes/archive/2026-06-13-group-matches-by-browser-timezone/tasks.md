## 1. Timezone-aware date key helper

- [x] 1.1 Add `localDateKey(iso: string, timeZone: string): string` to `lib/match-utils.ts` using `Intl.DateTimeFormat` `formatToParts` to return a sortable `YYYY-MM-DD` for the kickoff instant in the given IANA timezone; keep `utcDateKey` as the fallback.
- [x] 1.2 Add an `isValidTimeZone(tz: string): boolean` guard (try/catch around `Intl.DateTimeFormat({ timeZone })`) and a resolver that returns a usable key function, falling back to `utcDateKey` for missing/invalid timezones (no throw).
- [x] 1.3 Unit tests in `tests/` for `localDateKey`: late-night UTC instant bucketed to the previous local day for a negative-offset zone, a positive-offset zone, DST boundary sanity, and invalid-timezone → UTC fallback.

## 2. Browser timezone detection + cookie sync

- [x] 2.1 Add a constant for the cookie name (e.g. `TZ_COOKIE = "tz"`) and a small server-side reader helper that reads the `tz` cookie via `cookies()` from `next/headers` and returns a validated timezone or `null`.
- [x] 2.2 Create a client component (e.g. `components/timezone-sync.tsx`, `"use client"`) that reads `Intl.DateTimeFormat().resolvedOptions().timeZone`, compares to the current `tz` cookie, and on mismatch writes `tz` (`SameSite=Lax`, `Path=/`, ~1 year) and calls `router.refresh()`. No-op when already in sync.
- [x] 2.3 Mount `TimezoneSync` on the matches route so it runs on `/matches` without affecting other pages' rendering.

## 3. Wire local-day grouping into the matches list

- [x] 3.1 In `app/[locale]/(public)/matches/page.tsx`, read the validated `tz` cookie and build `byDay` keys with `localDateKey(m.kickoff_at, tz)` when known, else `utcDateKey` (preserve `kickoff_at ASC` day ordering).
- [x] 3.2 Pass the local `YYYY-MM-DD` key as `dayKey` to `MatchDaySection` (keeps `localStorage` collapse keys stable per local day) and recompute per-day count + `defaultOpen` over the local buckets.
- [x] 3.3 Render the day header date directly from the local day key (avoid the `${day}T00:00:00Z` round-trip through `LocalTime`); keep row times rendered via `LocalTime` as-is.

## 4. Verify

- [x] 4.1 Run typecheck, lint, and the unit tests; fix any failures. (260/260 tests pass; lint clean for changed files; only pre-existing `docker/volumes/functions/**` Deno typecheck errors remain, unrelated to this change.)
- [x] 4.2 Manually verify `/matches`: first load (no cookie) groups by UTC then refreshes to local; a near-midnight match sits under the day matching its displayed local time; header date agrees with row times; collapse choice persists per local day. (SSR smoke: `/en/matches` returns HTTP 200 with no cookie, with `tz=America/Los_Angeles`, and with an invalid `tz` — no server exception. Grouping math is unit-tested: LA off-by-one, Tokyo, DST, UTC-equivalence, header no-shift + localization. Full live browser regroup not exercised here because the self-hosted Supabase at `localhost:8000` is down, so the page hit its DB-error branch — environment condition, unrelated to this change.)
- [x] 4.3 Confirm no hydration warnings in the console and that no-JS / invalid-cookie paths degrade to UTC grouping without errors. (Invalid/missing cookie → UTC fallback confirmed at runtime (HTTP 200, no crash) and unit-tested. Hydration risk is strictly lower than before: the day header is now a pure server-rendered string (removed the client `LocalTime` UTC-midnight round-trip), `<TimezoneSync/>` renders `null` (no markup to mismatch), and row times keep the existing `LocalTime` `suppressHydrationWarning` path.)
