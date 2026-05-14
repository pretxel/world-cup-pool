## Context

`/leaderboard` today is parameterized by `?scope=today|overall` and `?date=YYYY-MM-DD`. The default is `today`. Behavior:

- `scope=today` → call `leaderboard_for_day(d, tz)` RPC; the `tz` comes from a client-set `tz` cookie written by `TimezoneCookie`. Falls back to `UTC`.
- `scope=overall` → select from `v_leaderboard_overall`.

Both data sources expose the same row shape (`LeaderboardRow` in `lib/db.ts`), so the table rendering is identical — only the data source and surrounding chrome (tab switcher, date input, copy) differ.

The `leaderboard_for_day` SQL function is defined in `supabase/migrations/20260513000000_init.sql`. It still has its `grant execute ... to anon, authenticated` so dropping it isn't free — and keeping it costs nothing.

## Goals / Non-Goals

**Goals:**
- Single leaderboard scope (global / overall) for visitors.
- Remove dead UI, dead client state, and unused cookies.
- Keep the existing global table styling and "You" highlight.
- Stale `?scope=today` URLs do not 404 or look broken.

**Non-Goals:**
- Don't drop the `leaderboard_for_day` SQL function. It's cheap to keep, useful for a future "Match-day recap" or "Yesterday's biggest movers" view. No migration here.
- Don't add a new scope, season filter, or competition filter.
- Don't redirect `?scope=today` URLs. Just ignore the param.
- Don't ship any DB migration.

## Decisions

**1. Always read from `v_leaderboard_overall`. Ignore query params entirely.**

Alternative: parse `?scope` and conditionally redirect or fall through. Rejected — adds branches for a query string that no longer has product meaning. The page's `searchParams` typing drops to a no-op.

**2. Delete `app/(public)/leaderboard/timezone-cookie.tsx`.**

It exists only to populate the `tz` cookie used by `leaderboard_for_day`. With the RPC gone from the call path, the cookie has no consumers. Grep confirms nothing else reads `cookies().get("tz")`. The file is the only thing pinning the `next/headers` cookie read on this route.

**3. Keep `LeaderboardRow` typed off the RPC return.**

`lib/db.ts:27` derives `LeaderboardRow` from `Database["public"]["Functions"]["leaderboard_for_day"]["Returns"][number]`. The view returns the same column shape. Switching the type alias to the view would be a minor cleanup but it's *not necessary* — both shapes are equivalent and the RPC type stays valid since the function remains in the DB. Leave as-is to keep this PR a pure UI deletion.

**4. Update copy in three files; nothing else.**

- `/leaderboard` page: header subtitle, leader card label, empty-state body, missing-self note.
- `/` homepage: feature-card "Daily and overall leaderboards refresh in real time." → "Leaderboard refreshes the moment a result lands.".
- `/how-it-works`: metadata description, "Daily leaderboard" Section 04 title + body. Convert to "Global leaderboard" framing.

**5. Remove all the local helpers that are now unused.**

`todayInTz`, the `Scope` type, the `ScopeLink` component, the date-form block. Tree-shake by hand — no `@ts-expect-error` or `// eslint-disable` shims.

## Risks / Trade-offs

- **Risk**: someone has bookmarked `?scope=today` → **Mitigation**: param is silently ignored, page still renders fine. No 404.
- **Risk**: external link or share copy referenced "Today's leaderboard" → **Mitigation**: search confirmed only the three files above mention "today" / "daily" in this context. Updated together.
- **Risk**: future requirement asks for per-day view → **Mitigation**: SQL function retained; can build a `/leaderboard/[date]` route later if/when the product wants it.

## Migration Plan

1. Edit `app/(public)/leaderboard/page.tsx`: drop scope/date param handling, drop `TimezoneCookie`, drop tab switcher + date form + helpers, always query `v_leaderboard_overall`, rewrite copy.
2. Delete `app/(public)/leaderboard/timezone-cookie.tsx`.
3. Update copy in `app/page.tsx` and `app/how-it-works/page.tsx`.
4. Typecheck + lint + tests + manual visual verify.

Rollback: revert the PR. No DB or runtime state involved.

## Open Questions

None.
