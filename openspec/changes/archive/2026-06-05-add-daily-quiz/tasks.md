## 1. Database

- [x] 1.1 Migration: `quiz_questions` (prompt, options[2–4], correct_index, active_on date unique, timestamps, updated_at trigger, range checks)
- [x] 1.2 Migration: `quiz_answers` (user, question, choice_index, is_correct, answered_at, unique(user,question)); user/question indexes
- [x] 1.3 View `v_quiz_questions_public` (id, prompt, options, active_on — no correct_index); granted to anon, authenticated
- [x] 1.4 RLS: `quiz_questions` admin-only via `is_admin()` (public reads through the view); `quiz_answers` owner-select, no direct insert/update/delete
- [x] 1.5 `answer_quiz(uuid, smallint)` SECURITY DEFINER: assert today's, insert with computed is_correct, reject dupes, return `{ is_correct, correct_index }`; granted to authenticated
- [x] 1.6 View `v_quiz_leaderboard` (10×correct points, total answered, first answer, rank); granted to anon, authenticated
- [x] 1.7 Applied to prod via `supabase db push` + seed; verified `v_quiz_questions_public` columns are `id, prompt, options, active_on` (no correct_index) and `quiz_questions` has no SELECT grant for anon/authenticated

## 2. Types & lib

- [x] 2.1 `lib/database.types.ts` updated for new tables/views/function (hand-authored — Docker down; re-run `supabase gen types` when DB is up)
- [x] 2.2 `QuizQuestionPublicRow`, `QuizAnswerRow`, `QuizLeaderboardRow` aliases in `lib/db.ts`
- [x] 2.3 `lib/quiz.ts` `computeStreak` + unit tests (`tests/quiz.test.ts`, 7 cases)

## 3. Answering flow

- [x] 3.1 Server action `submitQuizAnswer` wrapping `answer_quiz` (auth-gated; maps 23505 → already-answered)
- [x] 3.2 Client `AnswerCard`: options, submit, reveal correct/incorrect, lock after answering, sign-in guard
- [x] 3.3 `revalidatePath` the quiz routes after a successful answer

## 4. Quiz page

- [x] 4.1 `app/[locale]/(public)/quiz/page.tsx`: today's question via public view + user's answer; empty state when none
- [x] 4.2 Streak (via `computeStreak`) + quiz points stats
- [x] 4.3 Compact quiz leaderboard from `v_quiz_leaderboard`
- [x] 4.4 Page metadata + a "Quiz" nav link (discoverable surface)

## 5. Admin authoring

- [x] 5.1 `(admin)/admin/quiz/page.tsx` + `actions.ts`: create/list/delete questions, admin-gated (inherits admin layout + `assertAdmin`)
- [x] 5.2 zod validation (options length, correct_index in range, date format)

## 6. i18n & content

- [x] 6.1 `quiz` namespace + `nav.quiz` in `messages/en.json`
- [x] 6.2 Mirrored in `messages/es.json` and `messages/fr.json`
- [x] 6.3 Seed ~30 trivia questions (`supabase/seed/quiz.sql`), staggered `active_on` from 2026-06-06

## 7. Verify

- [x] 7.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` clean (71/71, incl. streak tests)
- [x] 7.2 Confirmed on prod: today's question renders with prompt+options but `correct_index` is absent from the `/quiz` payload
- [ ] 7.3 Answer flow: first grades + reveals; second rejected; anonymous cannot answer — BLOCKED: needs DB + session
- [ ] 7.4 Quiz leaderboard ranks correctly; pool leaderboard unchanged — BLOCKED: needs DB

## 8. Adversarial review follow-ups (8 confirmed)

- [x] 8.1 HIGH: admin form corrupted correct_index when a middle option was left blank (compaction shifted the index) → resolve correctness against the raw 4 slots, reject a blank chosen slot, remap the index to the compacted list
- [x] 8.2 MEDIUM: secret-answer rested on implicit invariants → pin `with (security_invoker = off)` on the public view and `revoke select on quiz_questions from anon, authenticated`
- [x] 8.3 MEDIUM: admin `revalidatePath` used bare paths (ineffective under localePrefix: always) → revalidate `/{en,es,fr}/quiz` + `/{en,es,fr}/admin/quiz`
- [x] 8.4 LOW: `answer_quiz` not-found used `q is null` → `if not found then`
- [x] 8.5 LOW: anonymous users saw clickable options with no upfront gate → show the sign-in hint before interaction
- [ ] 8.6 LOW: server action flattens RPC errors (not-today / out-of-range) to a generic message — accepted (no leak; choice range already guarded by zod)
- [ ] 8.7 LOW: a wrong stored answer doesn't re-reveal the correct option on reload — accepted, by-design of the secret-answer model (documented in code)
