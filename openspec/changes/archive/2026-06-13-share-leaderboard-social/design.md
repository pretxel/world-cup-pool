## Context

The pool already ships `pick-sharing`: a per-match brag with share buttons on the match page, a `noindex` landing page (`/share/pick/[matchId]`), a dynamic OG card (`/api/og/pick`), and a localized `sharePick` namespace. The share plumbing in `lib/share.ts` (`clampGoals`, `buildTweetIntentUrl`, `buildFacebookShareUrl`) and the `SharePickButtons` client component are already generic.

This change applies the same pattern to leaderboard standings. The public `/leaderboard` page renders the overall ranking from the `v_leaderboard_overall` view, whose rows expose `rank`, `display_name`, `total_points`, `exact_hits`, `winner_gd_hits`, `winner_hits`, `user_id`. The page already ships `user_id` to the client (to highlight "you"), and `display_name` is already publicly rendered — so a rank brag exposes no new data.

The decision captured up front: share the viewer's **own rank** (not a top-N table), for the **global** board only.

## Goals / Non-Goals

**Goals:**
- A signed-in viewer who appears in the overall ranking can share their standing to X, Facebook, the OS share sheet, and clipboard from `/leaderboard`.
- A public, `noindex` landing page renders a brag card for any ranked user and unfurls into a 1200×630 OG image styled like the brand scoreboard.
- Shared numbers stay truthful: the landing page and OG image read the **live** ranking, never trusting numbers from the URL.
- All share copy localized in en, es, fr.
- Reuse existing share helpers and the share-button component rather than forking them.

**Non-Goals:**
- Sharing a top-N standings table or a full leaderboard snapshot.
- Sharing per-group mini-boards (`leaderboard_for_group`) — global only.
- Any change to leaderboard scope, data source, or the `tz`-cookie independence governed by the `leaderboard` spec.
- New scope tabs, date pickers, or schema/migration work.

## Decisions

### 1. Identify the shared standing by `userId`; re-derive rank server-side
The share URL carries only `/{locale}/share/rank/{userId}`. The landing page and OG route look the user up in `v_leaderboard_overall` and render the **current** rank, points, and exact-hit count from the view.

- **Why over encoding numbers in the URL (the pick-sharing approach):** a predicted score is private and exists only where the sharer published it, so pick-sharing *must* carry it in the URL. A leaderboard rank is already public data. Re-deriving keeps the brag honest (no `?rank=1` tampering), survives rank drift, and the lookup is a single indexed view read on data that is already public.
- **Trade-off:** the rendered rank can differ from what the sharer saw when they copied the link. This is acceptable and arguably better — the link always tells the truth "as of now." Copy is framed in present tense to match.

### 2. Trust boundary and privacy
- The landing page renders only fields already public on `/leaderboard`: `display_name` (with the same `noName` fallback when null), `rank`, `total_points`, `exact_hits`, and the total player count. No email, no PII beyond the already-shipped `user_id` in the URL.
- Unknown `userId` (not present in the view) → **404** on both the landing page and the OG route, mirroring pick-sharing's unknown-match handling. No half-rendered card.
- The landing page is marked `noindex`/`nofollow` so brag URLs don't pollute search.

### 3. OG image route uses live data + short cache
`/api/og/rank?userId=...&locale=...` uses a cookie-less anon Supabase client (like `/api/og/pick`) to read the row, then renders the brag card.

- **Cache:** `public, max-age=300, s-maxage=300` (5 min) — NOT `immutable`. The pick card is immutable because its query params fully determine the pixels; a rank card depends on live standings that change as results land, so a long cache would freeze a stale rank. Five minutes bounds scraper load while keeping the unfurl roughly fresh.

### 4. Generalize the share-button component
`SharePickButtons` already takes a generic `{ shareUrl, shareText, labels }` API — nothing about it is pick-specific except the name. Rename/extract it to `components/share-buttons.tsx` (`ShareButtons`) and point both the pick call site and the new leaderboard call site at it.

- **Why over a copy-pasted `ShareRankButtons`:** the component is already generic; duplicating it would mean two places to fix the native-share/copy logic. The rename touches one existing call site (`/matches/[matchId]`) — low blast radius, covered by the pick scenarios.

### 5. Share-section visibility mirrors pick-sharing
The share section renders on `/leaderboard` only when the signed-in viewer has a row in the loaded ranking (`myRow` is already computed there). Anonymous visitors and signed-in users not yet ranked see no share section — they keep the existing "browse matches" CTA.

### 6. Share helper + localization
- Add `buildRankSharePath(locale, userId)` to `lib/share.ts` alongside `buildPickSharePath`.
- Add a `shareRank` messages namespace mirroring `sharePick`: `shareText` (interpolating `{rank}`, `{count}`, `{points}`), button labels (`shareOnX`, `shareOnFacebook`, `shareNative`, `copyLink`, `copied`), `heading`, landing copy (`pageEyebrow`, `pageHeading`, `pageTitle`, `pageDescription`), `cta`, `ogAlt`. Every key present in en, es, fr.

## Risks / Trade-offs

- **Rank drift between share and view** → render live everywhere and phrase copy in present tense ("currently #N"); honesty beats a frozen snapshot.
- **`userId` in the share URL** → it is already in the public `v_leaderboard_overall` view and already shipped to the client by `/leaderboard`; the page is `noindex` and renders nothing beyond existing public fields. No new exposure.
- **Null `display_name`** → reuse the leaderboard `noName` fallback in both the page and the OG card; no crash, no blank brag.
- **OG scraper load** → single indexed view lookup plus a 5-minute CDN cache absorbs bursts; flag asset fetches that the pick card does are not needed here (no flags on a rank card).
- **Renaming `SharePickButtons`** → the one existing consumer (`/matches/[matchId]`) is updated in the same change and exercised by the existing pick scenarios, so a missed import surfaces immediately.

## Migration Plan

Additive and read-only: no schema, no migration, no feature flag. Ship in one PR. Rollback is a plain revert — no data to unwind.
