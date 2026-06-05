## Why

The pool's core loop (pick → lock → score → climb) only rewards players once matches are live, leaving a dead zone before kickoff and lulls between match days where there's no reason to return. A one-tap **Daily Call** quiz gives players a small, recurring reason to open the app every day — building a return habit that the prediction game alone can't, especially in the pre-tournament window.

## What Changes

- Add a **Daily Quiz**: each calendar day (UTC) has one active multiple-choice question (World Cup trivia for v1). Signed-in players answer once, see whether they were right, and earn points.
- Track a **streak** — consecutive days a player has answered — surfaced as the engagement hook.
- Add a **separate quiz leaderboard** (total quiz points, then earliest first answer) so quiz skill never dilutes the prediction-pool ranking. A personal **streak** is shown on the quiz page as the daily hook.
- Add an **admin authoring** screen to create/schedule questions (reuses the existing admin area + RLS `is_admin()`).
- Surface a "Daily Call" entry: a `/[locale]/quiz` page plus a small teaser/CTA.
- Localize the quiz **chrome** in en/es/fr; question text itself stays single-language for v1 (same pragmatic stance as un-translated news titles).

Non-goals (v1): in-match "prop" predictions and auto-grading against live results; per-locale translated question content; merging quiz points into the main pool leaderboard; editing an answer after submit.

## Capabilities

### New Capabilities
- `daily-quiz`: the daily question lifecycle (one active question per UTC day), one-shot answering with anti-cheat (correct answer never sent before the player answers), scoring, streak tracking, the separate quiz leaderboard, and admin authoring.

### Modified Capabilities
<!-- none — net-new surface; the main `leaderboard` capability is untouched. -->

## Impact

- **Database**: new `quiz_questions` (prompt, 4 options, correct index, `active_on` date) and `quiz_answers` (user, question, chosen index, is_correct, answered_at, unique per user+question) tables; RLS (public read of questions but **without** the correct answer for unanswered; answers readable/writable by owner; admin writes questions); a `v_quiz_leaderboard` view mirroring `v_leaderboard_overall`. New migration + `lib/database.types.ts` regen.
- **App**: new route `app/[locale]/(public)/quiz/page.tsx` + an answer client component + a `submitQuizAnswer` server action (grades server-side, returns correctness, never trusts the client); a quiz leaderboard view/section; a home teaser; an admin authoring page under `(admin)/admin/quiz`.
- **Lib**: streak computation helper; quiz row aliases in `lib/db.ts`.
- **i18n**: a `quiz` namespace in `messages/{en,es,fr}.json`.
- **Content**: seed ~30 trivia questions to cover the pre-tournament dead zone and early days.
- **Security**: the active question's `correct_index` MUST NOT reach the client until the player has answered — enforced at the query/serialization layer, not just the UI.
