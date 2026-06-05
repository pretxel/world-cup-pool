## Context

The app is Next.js 16 (App Router, Server Components) on Supabase with next-intl (en/es/fr). It already has the exact primitives a quiz needs: per-user write tables guarded by RLS (`predictions`), a `SECURITY DEFINER` scoring function (`compute_match_scores`), a leaderboard view (`v_leaderboard_overall`), an admin area gated by `is_admin()`, and a daily cron. The Daily Quiz reuses all of these shapes rather than inventing new ones.

The central constraint: the question's correct answer is a secret until the player commits. Hiding it must happen at the data layer (Postgres has no column-level RLS), not just in the UI — otherwise the answer leaks in the page payload.

## Goals / Non-Goals

**Goals:**
- One active question per UTC day; signed-in players answer once and see if they were right.
- Correct answer never reaches the client before the player answers.
- Personal streak (consecutive answered days) as the return hook.
- Separate quiz leaderboard; the main pool ranking is untouched.
- Admin can author/schedule questions, reusing the existing admin pattern.

**Non-Goals (v1):**
- In-match prop predictions / auto-grading against live scores.
- Per-locale translated question content (chrome is localized; question text is single-language, like news titles).
- Merging quiz points into the pool leaderboard.
- Editing an answer after submit; multiple questions per day; back-filling past questions.

## Decisions

**1. Secret answer via a public view + a SECURITY DEFINER grading RPC.**
`quiz_questions` holds `correct_index`, and its base-table SELECT is restricted to admins. Anonymous/authenticated clients read a view `v_quiz_questions_public(id, prompt, options, active_on)` that simply omits `correct_index`. Answering goes through `answer_quiz(p_question_id uuid, p_choice smallint)` (SECURITY DEFINER): it verifies the question is today's, inserts into `quiz_answers` (rejecting a second answer via the unique constraint), computes `is_correct` server-side, and returns `{ is_correct, correct_index }`. The correct index is revealed only as the RPC's return value, after the row is written.

Alternatives considered: column-level RLS (doesn't exist in PG); filtering the column in a Server Component query (still requires the base row to be readable, leaking it to anyone who queries directly). The view + RPC keeps the secret server-side and makes answering atomic — same posture as `compute_match_scores`.

**2. "Today's question" = `active_on = (now() at time zone 'utc')::date`, unique per day.**
`active_on date unique` guarantees at most one daily question. The page selects the row from the public view where `active_on` is today (UTC). If none exists, the page shows a friendly "no question today" state. Using UTC keeps it consistent with how matches/leaderboard already bucket days.

**3. Scoring + streak.**
Each correct answer = 10 points. The quiz leaderboard view sums points per user and exposes total points + total answered + earliest first answer. Sort: `total_points desc, first_answer asc`. **Streak** (consecutive UTC days with an answer, ending today or yesterday) is computed app-side from the current user's `quiz_answers` dates and shown on `/quiz` — keeping the SQL view simple; a SQL-computed streak tiebreaker is a possible follow-up.

**4. Surfaces.**
`/[locale]/quiz` (Server Component): today's question via the public view + the user's existing answer (if any) → renders an `<AnswerCard>` client component that calls `submitQuizAnswer` (a thin server action wrapping the RPC, mirroring `submitPrediction`). Below: the player's streak + a compact quiz leaderboard. A small "Daily Call" teaser links here from home. Admin authoring lives at `(admin)/admin/quiz` reusing the admin server-action pattern.

**5. Reveal scope.**
The correct option is revealed only at answer time (RPC return). Re-visiting an already-answered question shows right/wrong (from the stored `is_correct`) but does not re-surface the correct option in v1 — avoids needing a per-row "reveal if answered" read path. Acceptable for a daily one-shot.

## Risks / Trade-offs

- **Answer leakage** → Mitigated by the view-omits-column + RPC design; the base table is admin-only. This is the single most important correctness property; specs must assert it.
- **Content cost** (someone must write trivia) → Seed ~30 questions up front (covers the pre-tournament gap + first days); authoring UI lets the admin top up. Props/auto-gen deferred.
- **Timezone confusion** ("today" differs from a player's local day) → Use UTC everywhere, matching existing match/leaderboard bucketing; document in the streak copy if needed.
- **Streak gaming / clock skew** → Streak derives from stored `answered_at` dates server-side; one answer per question (unique) caps abuse.
- **Scope creep into a second full leaderboard** → Keep the quiz board a single small view + section; explicitly separate from the pool board.

## Open Questions

- Points value (10 vs 1) and whether streak should also be a leaderboard tiebreaker in v1 — leaning points-only sort for simplicity.
- Should there be a lightweight "past questions" archive, or strictly today-only? v1 = today-only.
- Cron involvement: v1 needs none (questions are admin-scheduled by `active_on`); a future cron could auto-rotate or grade props.
