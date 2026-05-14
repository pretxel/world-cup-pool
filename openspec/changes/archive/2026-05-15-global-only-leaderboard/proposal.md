## Why

The leaderboard currently exposes two scopes — "Today" (default) and "Overall" — with a date picker tied to the visitor's timezone. Two issues:

1. **Wrong default for the product.** A pool's social pull is the season-long ranking. Most days no match has finished in the visitor's timezone, so "Today" lands new visitors on an empty board — a bad first impression and a misread of intent.
2. **Hidden complexity.** Two scopes, a timezone cookie, a date input, and an RPC call per render. None of this serves the global ranking that the rest of the app (home page hero, my-picks stats, post-match flow) is built around.

Removing the "Today" tab leaves a single, clear global leaderboard sourced from `v_leaderboard_overall`. Simpler UI, simpler code, no timezone gymnastics.

## What Changes

- **BREAKING (UI):** The "Today" tab on `/leaderboard` is removed. So is the scope tab switcher itself (one scope, no tabs). The date picker form is removed.
- `?scope=today` / `?scope=overall` query params are no longer read. Stale bookmarks render the same global leaderboard. No redirect is needed.
- `TimezoneCookie` client component is no longer rendered on `/leaderboard`. The file is deleted because it has no other consumer.
- Leader card and empty-state copy on `/leaderboard` is rewritten to drop "today" / "daily" language.
- `app/page.tsx` feature-card subtitle and `app/how-it-works/page.tsx` (metadata + "Daily leaderboard" section) are rewritten to describe the leaderboard as a single overall ranking.
- The DB function `leaderboard_for_day(date, tz)` is **kept** in the schema as a stable utility for future per-day views, but is no longer called from the app.

## Capabilities

### New Capabilities
- `leaderboard`: rules governing the public leaderboard page (scope, data source, copy).

### Modified Capabilities
<!-- none — no existing leaderboard spec; this is the first one. -->

## Impact

- Code: `app/(public)/leaderboard/page.tsx` (heavy edit), `app/(public)/leaderboard/timezone-cookie.tsx` (delete), `app/page.tsx` (copy tweak), `app/how-it-works/page.tsx` (copy + section rewrite).
- DB: no schema changes; `leaderboard_for_day` retained.
- Tests: no tests existed for the leaderboard page; none added (rendering is straightforward server-side; the migration is a pure deletion of a UI branch).
- SEO: `/leaderboard` metadata description updated to drop "today" / "daily".
- Routes: `/leaderboard?scope=today&date=...` URLs still resolve, ignored, render the global board.
