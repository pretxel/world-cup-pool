## Why

The daily quiz already drives habit-forming engagement — streaks, points, and a quiz leaderboard — but players have no way to broadcast that progress. The app already runs a proven viral loop for picks and leaderboard rank (a public share landing page + branded OG card + `ShareButtons`). The quiz, whose streaks are inherently brag-worthy, is the obvious next surface to extend it to, turning daily streaks into an acquisition channel at near-zero marginal cost by reusing existing sharing infrastructure.

## What Changes

- Add a share affordance to the quiz page (`/{locale}/quiz`) for signed-in users, surfacing their quiz **standing**: current streak, total points, and quiz rank.
- Add a public share landing page `/{locale}/share/quiz/[userId]` that re-derives the user's quiz standing live and renders a branded preview + CTA, mirroring `/share/rank/[userId]`.
- Add a dynamic Open Graph image route `/api/og/quiz` producing a 1200×630 branded card (flame + streak, points, rank), reusing `lib/og-fonts` and `lib/og-cache`.
- Add a `shareQuiz` i18n namespace (en/es/fr) for share text, button labels, and landing-page copy.
- Add a `buildQuizSharePath` helper to `lib/share.ts`.
- Share standing is re-derived server-side from a new public `v_quiz_standing` view; the URL carries only `userId` (no spoofable score params) — same trust model as rank sharing.

> Note (revised during implementation): streak cannot be read per-user by anon scrapers because `quiz_answers` is RLS own-rows-only. A read-only `v_quiz_standing` view (`security_invoker = off`, granted `anon`) exposes only the aggregate standing (streak/points/answered/rank), never raw answers. This adds one migration.

## Capabilities

### New Capabilities
- `quiz-sharing`: Signed-in players share their daily-quiz standing (current streak, total points, quiz rank) through a public, locale-aware landing page and a branded OG image, reachable from the quiz page. The standing shown is always re-derived server-side from stored answers, never taken from the URL.

### Modified Capabilities
<!-- None. `daily-quiz` requirements are unchanged; quiz sharing is purely additive
     and reuses the existing share/OG infrastructure. -->

## Impact

- **New code**: migration `20260614000400_quiz_standing_view.sql` (`v_quiz_standing`), `lib/quiz-standing.ts`, `app/[locale]/(public)/share/quiz/[userId]/page.tsx`, `app/api/og/quiz/route.tsx`, a share section on the quiz page, `buildQuizSharePath` in `lib/share.ts`, `v_quiz_standing` type in `lib/database.types.ts` + `lib/db.ts`, and `shareQuiz.*` keys in `messages/{en,es,fr}.json`.
- **Reused (no change)**: `components/share-buttons.tsx`, `lib/og-fonts.ts`, `lib/og-cache.ts`, `v_quiz_leaderboard` (composed into the new view).
- **Data**: one new read-only view via migration; otherwise read-only. No table/column changes, no new dependencies.
- **Auth/trust**: only signed-in users get a share link (a `userId` and standing are required); anonymous quiz visitors are unaffected. Landing page and OG card are publicly viewable by `userId`, exposing only display name + already-public leaderboard standing.
