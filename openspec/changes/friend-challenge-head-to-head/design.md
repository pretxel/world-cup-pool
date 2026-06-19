# Design — Friend Challenge Head-to-Head

## Context

The product already ships every primitive this feature needs:

- **Standings source.** `v_leaderboard_overall` is a public-read view exposing `user_id, display_name, rank, total_points, exact_hits, winner_gd_hits, winner_hits, first_submit` (`lib/database.types.ts:1016`). Both `/leaderboard` (`app/[locale]/(public)/leaderboard/page.tsx:103`) and `/share/rank` (`app/[locale]/(public)/share/rank/[userId]/page.tsx:18`) read it cookie-lessly.
- **Recent form source.** The `scores` table (`computed_at, hit_type, match_id, points, user_id`; `lib/database.types.ts:975`) records one row per scored match per user, with `hit_type ∈ {exact, winner_gd, winner, miss}` (`lib/db.ts` `HitType`). Ordering by `computed_at desc` per user yields a per-player form strip without new schema.
- **Share landing pattern.** `/share/rank`, `/share/quiz`, `/share/pick` each are `app/[locale]/(public)/share/<kind>/[id]/{page,loading}.tsx`: SSR via `createServerSupabaseClient`, numbers re-derived live (never from the URL), `robots: { index: false }`, and `generateMetadata` that points `openGraph.images` / `twitter.images` at an `/api/og/<kind>` URL.
- **OG route pattern.** `app/api/og/rank/route.tsx` runs on the **Node runtime** (`export const dynamic = "force-dynamic"`, no `runtime = "edge"`), uses a **cookie-less** `createClient` (social scrapers have no session), validates inputs before rendering (unknown user → 404), computes a strong **ETag** over exactly the drawn values via `cardETag` (`lib/og-cache.ts`), short-circuits to `304` on `If-None-Match`, sets `OG_CACHE_CONTROL` (`max-age=300, s-maxage=300, stale-while-revalidate=600`), and loads brand faces + a glyph-subset fallback via `loadOgFonts` / `loadDisplayNameFallback` (`lib/og-fonts.ts`).
- **Share plumbing.** `lib/share.ts` holds path builders (`buildRankSharePath`, `buildQuizSharePath`, `buildPickSharePath`) and intent-URL builders. `ShareButtons` (`components/share-buttons.tsx`) takes a prebuilt `shareUrl` + `shareText` + labels + a `context` string and emits `trackEvent("share_click", { platform, context })` (`lib/analytics.ts`).

This change composes these primitives; it does not invent new infrastructure.

## Goals / Non-Goals

**Goals:**

- A public URL `/[locale]/h2h/[a]/[b]` that, given two `user_id`s, renders a side-by-side comparison (rank, points, exact hits, recent form) read live from `v_leaderboard_overall` + `scores`.
- An OG card route `/api/og/h2h` that mirrors the `/api/og/rank` pipeline (Node runtime, cookie-less read, ETag/304, brand fonts, `OG_CACHE_CONTROL`) and draws a two-column "VS" scoreboard.
- A canonical, order-independent URL: `h2h/a/b` and `h2h/b/a` resolve to one preferred ordering so the same rivalry produces one cacheable card.
- A one-click "Challenge" entry point on the leaderboard for a logged-in viewer to build a head-to-head link against any listed player, reusing `ShareButtons` with `context: "h2h"`.
- Analytics parity: a `h2h_view` event on the landing page and a `h2h_challenge_created` (or reuse of `share_click` with `context: "h2h"`) event at the create-link affordance.

**Non-Goals:**

- No write path to `scores`, the leaderboard, or any competitive tie-breaker. Read-only projection only.
- No realtime updates on the comparison page (the OG card and landing both re-derive on request; the SWR CDN cache is enough). Live polling is out of scope.
- No new cron, service worker, web push, or VAPID — this is unrelated to the notification roadmap.
- No indexable SEO surface: the landing page stays `noindex` like the other share pages.
- No new auth: the page is public read, identical to `/share/rank`.
- No "challenge inbox", acceptance flow, or persisted rivalry records in the baseline (see Decisions for the optional phase).

## Decisions

- **Route placement: `(public)` group, segment `h2h/[a]/[b]`.** Sits beside the other public share landings. Two path segments keep it human-readable and reuse the framework's param parsing; both segments are `user_id`s, re-derived live, never trusted for numbers — matching the `/share/rank` "URL only identifies the user" rule.
- **Canonical ordering.** A pure helper in `lib/share.ts` (`buildH2HPath`) sorts the two ids deterministically (lexicographic by `user_id`) before building the path; the page issues a `redirect` to the canonical order when the incoming order differs. This collapses `a/b` and `b/a` to one URL so the OG ETag/CDN cache has a single key per rivalry, and the displayed "left vs right" is stable.
- **Recent form derivation.** A read-only helper (`lib/h2h.ts`) selects the last N (default 5) rows of `scores` per user ordered by `computed_at desc`, mapping `hit_type` to a pip class (`exact` / `winner*` = hit, `miss` = miss). Used by both the landing page and the OG route so the strip is identical in both. No RPC needed for the baseline; if per-user `LIMIT` over a combined query proves awkward in PostgREST, fall back to two scoped queries (one per user) — acceptable given only two users.
- **OG card composition.** Two mirrored columns (the `/api/og/rank` `Stat` layout, duplicated left/right) with a center "VS" divider; each column shows name, `#rank`, points, exact hits, and a row of form pips. ETag inputs = both users' `[rank, name, points, exact, form-string]` plus `locale` and a bumped `CARD_VERSION` (e.g. `h2h-1`) so layout changes invalidate prior cards. Reuses `OG_CACHE_CONTROL` unchanged.
- **Missing player handling.** If either `user_id` is absent from `v_leaderboard_overall` (never scored / unknown), the landing page returns `notFound()` and the OG route returns `404` — same as `/api/og/rank` and `/share/rank`. No half-rendered card.
- **Leaderboard entry point.** Add a lightweight per-row or panel affordance for the signed-in viewer to "Challenge" another listed player, which builds `${env.siteUrl}${buildH2HPath(locale, me, them)}` and feeds it into `ShareButtons` (`context: "h2h"`). Keeps the leaderboard's existing realtime/segment logic untouched.
- **Analytics.** Emit `trackEvent("h2h_view", { … })` from a small client tracker on the landing page (mirroring `LeaderboardViewTracker`) and `trackEvent` at the challenge-create affordance; `ShareButtons` already emits `share_click` with the `h2h` context.

## Risks / Trade-offs

- **No DB migration in the baseline — and that's deliberate.** Recent form is computed from `scores` at request time. Risk: two extra `scores` queries per render. Mitigation: the OG card is CDN-cached via `OG_CACHE_CONTROL` + ETag/304, and the landing page is cheap SSR; if profiling shows hot paths, a `head_to_head_form` RPC (single round-trip, `DISTINCT ON`/window function) is the optional next phase. **No schema change is required to ship the baseline.**
- **Stale numbers between score computation and CDN expiry.** Same trade-off the rank card already accepts: `stale-while-revalidate` may briefly serve an outdated card. Acceptable; the ETag flips as soon as either player's drawn values change.
- **Competitive integrity.** The page reads ranks/points but cannot alter them; there is zero write path, so it cannot affect scoring fairness or tie-breakers. Confirmed read-only.
- **Privacy.** It exposes the same fields already public on `/leaderboard` and `/share/rank` (display name, rank, points, exact hits) plus a derived win/miss form strip from already-public scored results — no new PII surface. Still `noindex` so it is not crawled.
- **URL guessability.** Anyone can construct an arbitrary `a`/`b` pair; this is by design (a challenge is a public comparison) and matches `/share/rank/[userId]` being constructible for any user.
- **Optional persistence phase (explicitly deferred).** A `head_to_head` log/analytics table (who challenged whom, when) would add a write path and a migration; it is **not** part of the baseline and is listed as a phased task only.
