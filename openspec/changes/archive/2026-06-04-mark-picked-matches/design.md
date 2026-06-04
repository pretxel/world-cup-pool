## Context

The matches list (`app/[locale]/(public)/matches/page.tsx`) is a public Server Component that fetches all matches and renders one `MatchRowCard` per fixture. It is currently auth-unaware. The match detail page and `my-picks` already know a user's predictions, but the list does not, so a signed-in player can't see at a glance which fixtures they've picked. Predictions are readable per-user via the existing `predictions_select_own` RLS policy (`user_id = auth.uid()`).

## Goals / Non-Goals

**Goals:**
- Mark rows the signed-in user has already predicted, with an accessible label.
- Zero behavior or query change for anonymous visitors.
- One additional lightweight query (signed-in only), reusing existing RLS.

**Non-Goals:**
- Showing the predicted scoreline on the list (stays on the match page).
- Any change to pick submission, locking, or scoring.
- A "remaining to pick" counter or filtering by picked state.

## Decisions

**1. Resolve the user and predicted ids in the page Server Component.**
Add `supabase.auth.getUser()` (same call `SiteNav` already makes per request). When a user exists, run one query: `from("predictions").select("match_id").eq("user_id", user.id)`. Build a `Set<string>` of predicted `match_id`s and pass `picked={pickedIds.has(m.id)}` to each `MatchRowCard`. When there is no user, skip the query entirely and pass `picked={false}` — anonymous path is unchanged.

Alternative considered: a join/embedded select on matches (`predictions!left(...)`). Rejected — a separate `match_id` select is simpler, sidesteps RLS interactions on embedded reads, and the result set (one user's picks) is tiny.

**2. Render the indicator inside `MatchRowCard`.**
Add a `picked: boolean` prop. When true, render a check badge (`CheckCircle2Icon` from lucide, already the icon library) near the existing stage/status badges, with `aria-label={tPicked}` (and the icon `aria-hidden`). Pass the `matches.rowPicked` string down like the other `t(...)` row strings already threaded into the card.

**3. Keep it a presentation concern.**
No new component file — the change lives in the existing page + its in-file card, matching how the row already receives its labels as props. New string `matches.rowPicked` added to all three locales.

## Risks / Trade-offs

- **Extra query per signed-in request** → Mitigation: single indexed `select` on `predictions(user_id)` (existing `predictions_user_id_idx`), returning only `match_id` for one user; negligible. Anonymous requests issue nothing extra.
- **Visual clutter on rows that already show a status badge** → Mitigation: small icon badge co-located with existing badges; design stays consistent with current row chrome.
- **Stale after a new pick** → The list is a Server Component; navigating back/refresh reflects the latest picks. The existing pick action already `revalidatePath`s match/my-picks routes; out of scope to add `/matches` revalidation here, but noted.

## Open Questions

- Should the right-side CTA also change from "Pick" to "Edit"/"Picked" for predicted rows? Out of scope for this change; the check badge is sufficient. Can follow up if desired.
