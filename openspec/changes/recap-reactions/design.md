## Context

When a match reaches `final`, `lib/match-summary.ts` writes an active recap row to `public.match_summaries` (`is_active` is the published version; `match_summaries_active_uq` enforces at most one active per match — see `supabase/migrations/20260616120000_match_summaries_versions.sql`) and an async Leonardo render produces a 4-panel comic recorded in `public.match_summary_images` (`status in ('pending','complete','failed')`, `match_summary_images_summary_uq` → one render per version; see `supabase/migrations/20260617130000_match_summary_images.sql`). RLS on both tables narrows public reads to the **active** version, so anon/authenticated only ever see the published comic.

The comic is surfaced in two SSR places:
- **Match detail** (`app/[locale]/(public)/matches/[matchId]/page.tsx`): inside the `matchSummary` section, gated on `match.status === "final"` plus an active `match_summaries` row and a `complete` `match_summary_images` render. The page already does the `supabase` reads, knows `user` (`supabase.auth.getUser()`), the active summary, and the match id.
- **Landing gallery** (`components/recent-recap-images.tsx`): fetches all `complete` renders (active-only via RLS → one per match), resolves match names, sorts, and shows the 5 most recent as cards linking to the match.

Established primitives this change reuses, all already in the codebase:
- **RLS posture**: authenticated select-own + public read, with guarded writes — e.g. `quiz_answers` (select-own; writes only through a SECURITY DEFINER `answer_quiz`), `match_summary_images` (public read scoped to the active version via an `exists (... s.is_active)` subquery). `public.is_admin()` and `public.set_updated_at()` helpers exist (`supabase/migrations/20260513000000_init.sql`).
- **Abuse ledger**: `public.group_invite_log` (`supabase/migrations/20260619170001_group_invite_log.sql`) — RLS enabled, no policies, service-role/definer-only, with a `(actor, time)` index for rolling-window counts. The reaction rate limit follows the same shape.
- **Realtime**: `realtime-leaderboard` added `public.scores` to the `supabase_realtime` publication (idempotent guard) and a client component (`components/leaderboard-live.tsx`) that subscribes via `createBrowserSupabaseClient()` and **re-fetches the authoritative view** on change with a debounce, falling back silently to the SSR snapshot.
- **Analytics**: `trackEvent(name, params)` (`lib/analytics.ts`) — a no-op-safe gtag wrapper already called as `share_click`, `prediction_submitted`, `quiz_answered`, `group_joined`.

## Goals / Non-Goals

**Goals:**
- Let a signed-in player add/remove an emoji reaction to a recap comic on the match detail page with a single tap (toggle), one row per `(user, summary, reaction)`.
- Show public, anonymous-readable aggregate reaction **counts** per type under the comic, plus the signed-in viewer's own toggled state, scoped to the **active** recap version (mirroring `match_summary_images` visibility).
- Surface an aggregate reaction count on the landing gallery cards as social proof.
- Enforce abuse guardrails proportional to a tap: DB uniqueness so one user cannot double-count, a server-side reaction-type allowlist, a per-user rate limit on toggle churn, and acceptance only for the active version of a `final` match.
- Make the feature measurable via `trackEvent`.
- Keep the live-counts layer additive and optional, degrading to the SSR snapshot exactly like `realtime-leaderboard`.

**Non-Goals:**
- **No free-text comments.** Free-form recap comments (with their heavier moderation queue, profanity filtering, reporting, and edit/delete UX) are explicitly deferred to a separate future change. This change ships emoji reactions only.
- No reactions on the recap **text** independently of the comic, no per-panel reactions, no threaded/nested reactions, no reaction on draft/non-active versions or non-final matches.
- No notifications (push or email) when someone reacts — that is the push-notifications bet's territory, not this change.
- No effect on scoring, points, predictions, `public.scores`, `compute_match_scores()`, or any leaderboard view. Reactions are purely social and carry zero competitive weight.
- No new infrastructure: no service worker, web push, or VAPID; no cron job; no new npm dependency.
- No change to recap generation, the Leonardo render pipeline, or the `match-recap-images` storage bucket.
- No moderation UI/admin tooling in this change beyond the structural guardrails (allowlist + uniqueness + rate limit + active/final scoping); an admin "hide reactions" toggle, if wanted, is a follow-up.

## Decisions

- **Reactions, not comments, in this change.** Emoji reactions are a tap with a fixed allowlist, so the abuse surface is a counter that cannot hold arbitrary text — no PII, no slurs, no moderation queue. This delivers the social-proof ("others reacted") half of the análisis bet at a fraction of the risk and lets us validate engagement before investing in a comments moderation pipeline.

- **One table, `public.recap_reactions`, keyed on the active summary version.** Columns: `id uuid pk`, `user_id uuid not null references profiles(id) on delete cascade`, `summary_id uuid not null references match_summaries(id) on delete cascade`, `match_id uuid not null references matches(id) on delete cascade` (denormalized for the landing-gallery aggregate and for cheap match-scoped reads), `reaction text not null check (reaction in (<allowlist>))`, `created_at timestamptz not null default now()`. **`unique (user_id, summary_id, reaction)`** is the core anti-inflation guardrail — a user can hold each reaction type at most once per recap version. Indexes: on `summary_id` (counts), on `(user_id, summary_id)` (the viewer's own state), on `(match_id)` (gallery aggregate). Keying on `summary_id` (not `match_id` alone) means a re-render that activates a new version starts a fresh reaction set, consistent with how the comic itself is active-version-scoped; the denormalized `match_id` still lets the gallery sum across whatever version is active.

- **Public-read counts via an active-version-scoped view, writes via RLS insert/delete.** A view `public.v_recap_reaction_counts` (security_invoker off, like `v_quiz_questions_public`, so it can aggregate past select RLS while exposing only counts) returns `(summary_id, match_id, reaction, count)` **only for rows whose `summary_id` is the active version** — granted to anon + authenticated. The base table's RLS: `select` own rows to authenticated (for the viewer's toggled state); `insert`/`delete` to authenticated with `with check`/`using` that the row's `user_id = auth.uid()` AND the `summary_id` belongs to the active version of a `final` match (an `exists (... join matches m ... where s.is_active and m.status = 'final')` subquery, the same shape as `match_summary_images_select_public`). This keeps the active/final gate in SQL so it holds regardless of which client writes.

- **Toggle through a thin server action or SECURITY DEFINER RPC, not raw client writes — for the rate limit.** RLS enforces ownership and active/final scoping, but a **per-user rate limit on toggle churn** needs a counted window. Following the `group_invite_log` posture, a small ledger (or a `toggle_recap_reaction(p_summary_id, p_reaction, p_on boolean)` SECURITY DEFINER function with `set search_path = public`) checks the rolling-window count before applying the insert/delete and rejects abusive churn. The allowlist is also re-checked server-side (defense in depth alongside the table `check`). The optimistic client update is reconciled against the returned authoritative count, like the realtime leaderboard reconciles against the view.

- **SSR-first counts; optional Realtime is additive.** The match-detail page fetches counts from `v_recap_reaction_counts` and the viewer's own reactions server-side (it already does the surrounding reads), seeds a client `recap-reactions` component as initial state, and renders the bar. Phase 2 (optional) adds `public.recap_reactions` to the `supabase_realtime` publication (idempotent guard) and subscribes the bar to `postgres_changes`, re-fetching counts on change with a debounce — identical to `components/leaderboard-live.tsx`. If Realtime never connects, the SSR snapshot stands and the toggle still works via the server action. Anonymous visitors see counts (public read) but cannot react (no auth) — the bar shows a sign-in prompt, like the prediction form's `signInPrompt`.

- **Landing gallery shows a summed count, not per-type breakdown.** `components/recent-recap-images.tsx` already does one bounded fetch of renders + a match lookup; it adds one aggregate read (sum of counts per `match_id` from `v_recap_reaction_counts`) and renders a single number on each card (e.g. "128 reactions"). No interactivity on the gallery — tapping the card still navigates to the match detail where the full bar lives.

- **Analytics names mirror the existing convention.** `recap_reaction_added` / `recap_reaction_removed` with `{ reaction, match_id }`, emitted client-side after the toggle resolves, consistent with `share_click`/`prediction_submitted`. No server-side analytics.

## Risks / Trade-offs

- **DB migration required.** New `public.recap_reactions` table + RLS + counts view (+ optional rate-limit ledger and toggle RPC, + optional realtime publication entry). All additive — it touches no existing table, view, RLS policy, scoring path, or the recap/render pipeline. Mitigation: ship as a self-contained timestamped migration; nothing else depends on it to keep working.

- **Active-version churn resets reactions.** Keying on `summary_id` means an admin re-render that activates a new recap version starts the reaction count from zero for that match. Trade-off accepted: it matches how the comic itself is active-version-scoped (a new comic is a new artifact), and re-renders are rare/admin-driven. The denormalized `match_id` keeps the gallery aggregate coherent against whatever version is active. If a follow-up wants reactions to carry across re-renders, it can sum by `match_id` instead — the data supports it.

- **Rate limit vs. legitimate toggling.** A player may genuinely add/remove a reaction a few times. The window must be loose enough not to annoy (e.g. cap rapid flips, not normal use) while still blocking scripted churn. Mitigation: tune the window like the invite caps; the uniqueness constraint already bounds the steady-state (one row per type), so the limit only guards flip-spam.

- **Anonymous read, no write.** Counts are public so social proof shows to logged-out visitors and on the landing page, but reacting requires auth. Trade-off: a logged-out tap shows a sign-in prompt rather than silently failing — a deliberate funnel into sign-in, consistent with the rest of the app.

- **Realtime is optional and best-effort.** If Phase 2 ships and the publication entry is missing or Realtime is disabled, counts simply don't live-update; the SSR snapshot and the post-toggle re-fetch keep the bar correct. No hard dependency. Like `realtime-leaderboard`, anon visitors get no live delivery (RLS-scoped), which is fine — they see the SSR snapshot.

- **No moderation queue.** Because there is no free text, the abuse surface is count inflation (blocked by uniqueness) and churn (blocked by the rate limit). The cost is that reactions cannot express nuance — accepted as the explicit scope boundary; comments are a separate, heavier change.

- **Competitive-scoring impact: none.** Reactions never write to `public.scores`, never call `compute_match_scores()`, and are absent from every leaderboard view. A player cannot gain or lose standing by reacting. This is an explicit invariant of the design, called out so reviewers can confirm the migration adds no scoring coupling.
