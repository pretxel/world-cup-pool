## Why

Recap comics are the platform's most shareable content: when a match goes `final`, `lib/match-summary.ts` writes a dramatic recap and an async Leonardo render produces a 4-panel comic stored in `match_summary_images` (one `complete` render per active version). Those comics are surfaced in two places — the match detail page (`app/[locale]/(public)/matches/[matchId]/page.tsx`, the `matchSummary` section) and the landing gallery (`components/recent-recap-images.tsx`, up to 5 most-recent renders). But the engagement loop dead-ends there: a player can look at a comic and share it, yet cannot react to it or see that anyone else did. There is no social proof, no "200 fans reacted", no lightweight way to register a feeling without the friction of writing.

This is large bet **"Comentarios/reacciones en recaps"** from `análisis.md` (§4 Apuestas grandes; §5.C Contenido; §7 Largo plazo): turn passive recap views into a social touchpoint. We scope this change to **emoji reactions** (a tap, one per user per recap per type), which is the lower-risk, higher-velocity half of the bet — it adds a visible counter and FOMO ("others reacted") with minimal moderation surface, while a free-text comments system (with the heavier abuse/moderation burden) is explicitly deferred to a future change. Reactions reuse the platform's established primitives: RLS authenticated-insert-own, public-read aggregate counts, optional Supabase Realtime (the same pattern that already powers the realtime leaderboard), and `trackEvent` analytics. A migration is required.

## What Changes

- Add a `recap_reactions` table: one row per `(user_id, summary_id, reaction)` with RLS — authenticated users insert/delete their **own** rows; reaction **counts** are publicly readable (anon + authenticated) but scoped to the **active** recap version, mirroring how `match_summary_images` exposes only the active render.
- Constrain reactions to a small fixed allowlist of emoji reaction types (e.g. a handful of football-flavored reactions) so the surface stays a tap, not free text — no free-form input, no moderation queue.
- Expose aggregate counts via a read path that the active recap reads from: either a `v_recap_reaction_counts` view or a `recap_reaction_counts(summary_id)` read, returning per-type totals (and, for a signed-in viewer, which types they have reacted to).
- Render a reaction bar under the recap comic on the **match detail page** (`matchSummary` section) showing the per-type counts and the viewer's own toggled state; tapping toggles the viewer's reaction with an optimistic update backed by a server action / RPC.
- Surface an aggregate count on the **landing gallery** cards (`components/recent-recap-images.tsx`) as social proof (e.g. total reactions per comic) so the home feed shows which recaps are resonating.
- Add **abuse/moderation guardrails** appropriate to a tap: a hard uniqueness constraint (`unique (user_id, summary_id, reaction)`) so a user cannot inflate a count, a server-side allowlist check on the reaction type, a per-user rate limit on toggle churn (a lightweight ledger/window, same posture as `group_invite_log`), and reactions only accepted for the **active** version of a recap on a **final** match.
- Optionally make counts live via Supabase Realtime: add `recap_reactions` to the `supabase_realtime` publication and let the match-detail reaction bar re-fetch counts on change — additive, degrades to the SSR snapshot if Realtime never connects (same graceful-fallback pattern as `realtime-leaderboard`). This is phased and optional.
- Instrument `trackEvent("recap_reaction_added")` / `trackEvent("recap_reaction_removed")` (with `reaction` + `match_id`) so the recap engagement loop becomes measurable, consistent with the existing `share_click` / `prediction_submitted` events.

## Capabilities

### New Capabilities
- `recap-reactions`: authenticated emoji reactions on recap comics with public, active-version-scoped aggregate counts surfaced on the match detail page and the landing gallery, backed by RLS (insert/delete own, public-read counts), a fixed reaction allowlist, abuse guardrails (uniqueness + rate limit + active/final scoping), optional Supabase Realtime live counts, and `trackEvent` analytics.

### Modified Capabilities

## Impact

- Data: new migration under `supabase/migrations/` creating `public.recap_reactions` (FK to `match_summaries.id` via `summary_id`, FK to `matches.id` via `match_id`, FK to `profiles.id` via `user_id`, `reaction text` with a `check` allowlist, `created_at`, `unique (user_id, summary_id, reaction)`, indexes on `summary_id` and `(user_id, summary_id)`), RLS (`enable row level security`; authenticated select-own + public-read counts via a view/RPC; authenticated insert/delete scoped to `auth.uid()` and to the active version of a final match), and a `set_updated_at`-style trigger only if needed. A counts read path (`v_recap_reaction_counts` view or `recap_reaction_counts()` SECURITY DEFINER function) for the active-version aggregate.
- Code: `app/[locale]/(public)/matches/[matchId]/page.tsx` — render a reaction bar in the existing `matchSummary` section (already gated on `match.status === "final"` and a completed render); pass SSR-fetched counts + the viewer's own reactions to a new client component. A server action or RPC (`lib/match-summary.ts` neighborhood, e.g. `lib/recap-reactions.ts`) to toggle a reaction with the allowlist + rate-limit + active/final checks.
- Components: new client component (e.g. `components/recap-reactions.tsx`) using `createBrowserSupabaseClient()` for optional live counts and optimistic toggling; `components/recent-recap-images.tsx` extended to show an aggregate reaction count per card.
- Analytics: `recap_reaction_added` / `recap_reaction_removed` events via the existing `trackEvent` wrapper (`lib/analytics.ts`).
- Realtime (phased/optional): add `public.recap_reactions` to the `supabase_realtime` publication; the match-detail reaction bar subscribes and re-fetches counts on change, falling back to SSR.
- Competitive scoring: none — reactions never touch `public.scores`, `compute_match_scores()`, predictions, or any leaderboard view; they carry zero points and cannot affect standings.
- No new infrastructure (no service worker / web push / VAPID), no cron, no new dependency (`@supabase/ssr` already in use). No change to recap generation, the Leonardo render pipeline, or the comic storage bucket.
