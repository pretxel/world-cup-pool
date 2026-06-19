## 1. Database: reactions table, RLS, and counts

- [ ] 1.1 Create a timestamped migration under `supabase/migrations/` (e.g. `<timestamp>_recap_reactions.sql`) defining `public.recap_reactions` with `id uuid pk default gen_random_uuid()`, `user_id uuid not null references public.profiles(id) on delete cascade`, `summary_id uuid not null references public.match_summaries(id) on delete cascade`, `match_id uuid not null references public.matches(id) on delete cascade`, `reaction text not null check (reaction in (<allowlist>))`, `created_at timestamptz not null default now()`.
- [ ] 1.2 Add `unique (user_id, summary_id, reaction)` (anti-inflation), plus indexes on `summary_id`, `(user_id, summary_id)`, and `match_id`.
- [ ] 1.3 `alter table public.recap_reactions enable row level security`.
- [ ] 1.4 Add an authenticated `select` policy for own rows (`user_id = auth.uid()`) so the viewer's selected reactions can be read.
- [ ] 1.5 Add authenticated `insert`/`delete` policies with `with check`/`using` requiring `user_id = auth.uid()` AND an `exists (...)` subquery proving `summary_id` is the active version (`match_summaries.is_active`) of a `final` match (`matches.status = 'final'`), mirroring the `match_summary_images_select_public` shape.
- [ ] 1.6 Create the public counts read path: a `public.v_recap_reaction_counts` view (`security_invoker = off`, like `v_quiz_questions_public`) returning `(summary_id, match_id, reaction, count)` for active-version rows only; `grant select` to `anon, authenticated`.
- [ ] 1.7 Add a migration header comment documenting active/final scoping, the uniqueness anti-inflation guardrail, and that reactions carry no points / never touch `public.scores`.

## 2. Abuse / moderation guardrails

- [ ] 2.1 Implement the per-user rate limit on toggle churn: either a `SECURITY DEFINER` `toggle_recap_reaction(p_summary_id uuid, p_reaction text, p_on boolean)` function (`set search_path = public`) that counts a rolling window before applying, or a small `recap_reaction_log` ledger (RLS enabled, no policies, service-role/definer-only) following the `group_invite_log` posture; `grant execute` to `authenticated` if using the function.
- [ ] 2.2 Re-check the reaction allowlist server-side (defense in depth alongside the table `check`).
- [ ] 2.3 Re-assert active-version + final-match scoping in the write path so it holds regardless of client.

## 3. Server toggle path and reads

- [ ] 3.1 Add a server module (e.g. `lib/recap-reactions.ts`) with a toggle action/RPC wrapper and a typed shape for counts + the viewer's own reactions.
- [ ] 3.2 Add a server-side read used by the page: per-type counts for the active `summary_id` (from `v_recap_reaction_counts`) and the signed-in viewer's own reactions (own-row select).
- [ ] 3.3 Add a gallery aggregate read: summed reaction count per active `match_id` for `components/recent-recap-images.tsx`.
- [ ] 3.4 Regenerate `lib/database.types.ts` for the new table/view/function.

## 4. Match detail reaction bar

- [ ] 4.1 Add a client component (e.g. `components/recap-reactions.tsx`) that accepts the SSR counts and the viewer's own reactions, renders the allowlisted reaction buttons with counts and selected state, and toggles optimistically via the server action/RPC, reconciling against the returned authoritative count.
- [ ] 4.2 For anonymous viewers, show counts read-only with a sign-in prompt (reuse the prediction-form `signInPrompt` pattern), not a silent failure.
- [ ] 4.3 In `app/[locale]/(public)/matches/[matchId]/page.tsx`, fetch counts + own reactions inside the existing `match.status === "final"` recap branch and render the bar within the `matchSummary` section, below the comic.
- [ ] 4.4 Add i18n strings for the reaction bar (heading, sign-in prompt, reaction labels/aria) to the message catalogs.

## 5. Landing gallery social proof

- [ ] 5.1 Extend `components/recent-recap-images.tsx` to read the summed reaction count per shown match and render a single aggregate count badge per card; render nothing misleading when zero.
- [ ] 5.2 Keep the card a link to the match detail page (no reacting from the gallery) and keep the existing grid/sort/limit behavior intact.

## 6. Analytics

- [ ] 6.1 Emit `recap_reaction_added` / `recap_reaction_removed` via `trackEvent` (`lib/analytics.ts`) with `{ reaction, match_id }` after the toggle resolves, consistent with `share_click` / `prediction_submitted`.

## 7. Optional: live counts via Realtime (phase 2)

- [ ] 7.1 Create a timestamped migration adding `public.recap_reactions` to the `supabase_realtime` publication with an idempotent guard (same pattern as the scores publication migration).
- [ ] 7.2 In `components/recap-reactions.tsx`, subscribe via `createBrowserSupabaseClient()` to `postgres_changes` on `public.recap_reactions`, re-fetch counts on change with a debounce, and remove the channel on unmount.
- [ ] 7.3 Fall back silently to the SSR counts if the channel never connects or a re-fetch errors.

## 8. Verification

- [ ] 8.1 Run typecheck and lint; fix any issues.
- [ ] 8.2 Run the test suite (and add coverage for: uniqueness blocks double-count, allowlist rejection, non-final/non-active rejection, own-row-only RLS, no `public.scores` write).
- [ ] 8.3 Apply the migration locally and manually verify: signed-in toggle add/remove updates counts; anonymous viewer sees counts + sign-in prompt; a non-final match shows no bar; the landing gallery shows the aggregate count.
- [ ] 8.4 Confirm reacting writes no row to `public.scores` and changes no leaderboard rank (competitive-scoring invariant).
- [ ] 8.5 Run `openspec validate "recap-reactions"` and confirm it passes.
