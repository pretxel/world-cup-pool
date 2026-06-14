## Context

The quiz page (`/{locale}/quiz`) already computes, per signed-in user, a current **streak** (`computeStreak` over `quiz_answers.answered_at`), **total points** (10 × correct answers), an **answered count**, and shows a **quiz leaderboard** (`v_quiz_leaderboard`, with `rank`, `display_name`, `total_points`). None of this is shareable today.

Two sharing capabilities already exist and define the house pattern:
- `pick-sharing`: `/share/pick/{matchId}?h&a` + `/api/og/pick` — data carried in the URL (clamped, since picks are private).
- `leaderboard-sharing`: `/share/rank/{userId}` + `/api/og/rank` — standing **re-derived live** from a public view, URL carries only `userId`.

Both reuse `components/share-buttons.tsx` (X intent, Facebook sharer, `navigator.share`, copy-link), `lib/share.ts` (URL builders), `lib/og-fonts.ts`, and `lib/og-cache.ts` (ETag / `304` / `stale-while-revalidate`).

Quiz standing is public-ish (the quiz leaderboard already displays names and points) and changes daily, so this change follows the **`leaderboard-sharing` model**, not the pick model.

## Goals / Non-Goals

**Goals:**
- Let a signed-in player share their quiz **standing** — streak, total points, and quiz rank — from the quiz page.
- A public, locale-aware landing page `/{locale}/share/quiz/{userId}` that re-derives the standing live and unfurls into a branded 1200×630 OG card.
- Maximum reuse of the existing share/OG primitives; zero new dependencies; only a single read-only view added (no table/column changes).

**Non-Goals:**
- Per-question "I answered today's question correctly" sharing (timely, but a separate surface — deferred).
- Sharing for anonymous users (no `userId`, no standing).
- Any change to `daily-quiz` grading, scoring, or the `v_quiz_leaderboard` view.
- New persisted state (no share counts/analytics tables in this change).

## Decisions

**1. Re-derive standing live from `userId` via a public view; never trust the URL.**
The share URL is `/{locale}/share/quiz/{userId}` with no score/streak params (mirrors `buildRankSharePath`). The landing page and `/api/og/quiz` read the new `v_quiz_standing` view at request time. *Why a view:* `quiz_answers` is RLS own-rows-only, so an anon scraper (Facebook/X) or another viewer cannot read a user's answers to compute their streak. `v_quiz_standing` (`security_invoker = off`, granted `anon`) computes the streak in SQL (mirroring `computeStreak`) and exposes only the aggregate standing — never raw answers. It composes `v_quiz_leaderboard` so rank/points/answered/name match the on-site quiz leaderboard. *Alternative rejected:* encoding streak/points in the URL (pick-style) — spoofable and goes stale; reading `quiz_answers` directly — blocked by RLS for non-owners.

**2. Reuse, don't rebuild.** Add only `buildQuizSharePath(locale, userId)` to `lib/share.ts`; mount the existing `ShareButtons` via a tiny server-computed wrapper on the quiz page; build the OG card with `lib/og-fonts` + `lib/og-cache` exactly as `/api/og/rank` does. *Why:* one share component, one cache strategy, consistent UX. *Alternative rejected:* a bespoke quiz share button/card — duplicates tested code.

**3. Gating: share only the viewer's own standing, only when they have one.** The quiz page renders the share section only for a signed-in viewer with `answeredCount > 0` (a streak/points to brag about). *Why:* matches `leaderboard-sharing`'s "own row only" rule and avoids empty cards. The standing block already exists; the share section sits beside it.

**4. Landing/OG existence rule.** A row in `v_quiz_standing` means the user has played. An unknown `userId` (no row → no quiz answers) → `404`. Because the view composes `v_quiz_leaderboard`, every user who has answered is ranked (rank is over all answerers, including zero-correct players), so there is no "answered but unranked" gap to special-case. *Alternative rejected:* a separate "has answered" probe against `quiz_answers` — blocked by RLS and redundant with the view.

**5. Caching mirrors rank, not pick.** The OG response uses a short public `max-age` (~5 min) + `stale-while-revalidate`, and a strong `ETag` over the exact rendered values (streak, points, answered, rank, ranked-player count, display name, locale, card-design version). *Why:* the standing changes daily; an immutable cache would serve stale brags. Reuses `lib/og-cache` helpers (`cardETag`, `ifNoneMatchSatisfied`, `notModified`, `OG_CACHE_CONTROL`).

**6. Localization via a new `shareQuiz` namespace.** Mirror `shareRank` keys (`heading`, `shareText`, `shareOnX`, `shareOnFacebook`, `shareNative`, `copyLink`, `copied`, `pageEyebrow`, `pageHeading`, `pageTitle`, `pageDescription`, `cta`, `ogAlt`, plus `streakLabel`, `pointsLabel`, `rankLabel`, `unranked`). The share URL carries the sharer's locale so recipients land localized. *Why:* consistent with the i18n capability; en/es/fr required.

**7. Node runtime + `force-dynamic` for the OG route.** Same as `/api/og/rank` (`lib/og-fonts` reads font binaries via `node:fs/promises`).

## Risks / Trade-offs

- **Streak becomes publicly viewable by `userId`** → standing already on the public quiz leaderboard plus a low-sensitivity streak number; no email/PII. Mitigation: expose only display name + streak + points + answered + rank; nothing else.
- **Per-render derivation cost (one user's answers + a leaderboard lookup)** → small, single-user queries; mitigated by the short OG cache + `ETag`/`304` short-circuit (no rasterization on cache hit). The HTML landing page is dynamic but cheap.
- **`computeStreak` is UTC-day based** → the shared streak matches what the quiz page shows the user (same helper), so no surprising mismatch between page and card.
- **Quiz leaderboard may omit unranked users** → handled by Decision 4 (render without a numeric rank rather than 404).
- **OG scrapers ignore short cache** → acceptable; the card is correct at fetch time, which is what unfurls show.

## Migration Plan

Adds one read-only view (`v_quiz_standing`) via migration `20260614000400`; no table/column changes, no data backfill. Deploy = apply the migration, then ship the landing route, OG route, `lib/share` helper, `lib/quiz-standing` helper, quiz-page share section, and `shareQuiz` messages in en/es/fr. Rollback = `drop view public.v_quiz_standing;` and revert the commit; nothing persisted.

## Open Questions

- Should the quiz share also offer a timely per-question result card ("got today's question right")? Deferred to a follow-up; this change ships the evergreen streak/standing share first.
- Confirm `noindex` on the landing page (chosen, matching `pick`/`rank`) vs. allowing indexing for SEO — defaulting to `noindex` for per-user ephemeral pages.
