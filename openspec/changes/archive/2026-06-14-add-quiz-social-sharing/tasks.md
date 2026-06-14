## 1. Public standing data (streak is RLS-private; needs a public view)

- [x] 1.1 Add migration `supabase/migrations/20260614000400_quiz_standing_view.sql` creating `v_quiz_standing` (`security_invoker = off`, granted `anon, authenticated`): reuses `v_quiz_leaderboard` for rank/points/answered/name and adds a SQL streak (gaps-and-islands, UTC days ending today/yesterday — mirrors `lib/quiz.computeStreak`).
- [x] 1.2 Add `v_quiz_standing` Row type to `lib/database.types.ts` and `QuizStandingRow` to `lib/db.ts`.
- [x] 1.3 Add `lib/quiz-standing.ts` (`loadQuizStanding(supabase, userId)`) reading the view live + ranked-player count; returns `null` when the user has no answers (no row). Accepts the caller's client so the cookie-bound page and cookie-less OG route share it.

## 2. Share URL helper

- [x] 2.1 Add `buildQuizSharePath(locale, userId)` to `lib/share.ts` → `/{locale}/share/quiz/{userId}` (no params), mirroring `buildRankSharePath`.

## 3. Localization (shareQuiz namespace)

- [x] 3.1 Add `shareQuiz` namespace to `messages/en.json` (heading, shareText, button labels, page copy, streak/points/rank labels, statPlayers, cta, ogAlt).
- [x] 3.2 Add `shareQuiz` to `messages/es.json` (Spanish).
- [x] 3.3 Add `shareQuiz` to `messages/fr.json` (French).
- [x] 3.4 `shareText`/`pageTitle`/`pageDescription`/`ogAlt` interpolate streak/points/rank/count and read naturally.

## 4. Quiz page share section

- [x] 4.1 In `app/[locale]/(public)/quiz/page.tsx`, when signed in and `answeredCount > 0`, load the standing via `loadQuizStanding` so the share text matches the card.
- [x] 4.2 Render the existing `ShareButtons` (shareUrl from `env.siteUrl + buildQuizSharePath`, localized `shareQuiz` text + labels) beside the streak/points/answered stats; no new share component.
- [x] 4.3 Section absent for anonymous users and signed-in users with zero answers (guarded by `user && quizShare`).

## 5. Public share landing page

- [x] 5.1 Create `app/[locale]/(public)/share/quiz/[userId]/page.tsx`, mirroring `share/rank/[userId]`.
- [x] 5.2 Load the standing live via `loadQuizStanding`; `notFound()` when the user has no quiz answers.
- [x] 5.3 Render display name (quiz `noName` fallback), streak headline (flame), points, and rank, plus a CTA to `/{locale}/quiz`.
- [x] 5.4 `generateMetadata` declares OG + Twitter `summary_large_image` pointing at `/api/og/quiz`, and a `noindex` robots directive.

## 6. Open Graph quiz card route

- [x] 6.1 Create `app/api/og/quiz/route.tsx` modeled on `/api/og/rank` (Node runtime, `force-dynamic`, 1200×630, brand fonts/colors).
- [x] 6.2 Read the standing live via `loadQuizStanding` (cookie-less anon client); 404 for a `userId` with no answers.
- [x] 6.3 Render the card: streak headline, with points and rank as the two stats; brand scoreboard style.
- [x] 6.4 Strong `ETag` over (`quiz-1` version, streak, points, rank, players, name, locale) via `lib/og-cache`; `304` on `If-None-Match`; short `Cache-Control` + `stale-while-revalidate`.

## 7. Verification

- [x] 7.1 `openspec validate add-quiz-social-sharing`, `pnpm typecheck`, `pnpm lint` (0 errors), `pnpm test` (299 passing) all clean.
- [ ] 7.2 Runtime check against the local stack (apply the migration, then verify quiz share section, `/share/quiz/{id}`, OG 1200×630, 404 for unknown user, es/fr) — pending Docker stack up.
- [ ] 7.3 Verify OG caching live: matching `If-None-Match` → `304`; `ETag` changes after standing changes — pending Docker stack up.
