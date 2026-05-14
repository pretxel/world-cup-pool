# World Cup 2026 Pool — End-to-End Test Plan

**App under test:** https://world-cup-pool-sepia.vercel.app (production) and `pnpm dev` on `http://localhost:3000` (local).
**Backend:** Supabase project ref `pabzhdozyoepvjeqxega` (eu-west-1). 104 fixtures pre-seeded.
**Spec source of truth:** `openspec/changes/add-world-cup-2026-pool/specs/**/*.md`.
**Stack quirk:** This is **Next.js 16 App Router**. Cache invalidation uses `revalidateTag(... , 'max')`. Server Components/Actions only; do not assume `pages/`.

---

## How to use this plan

- Walk top-to-bottom. Each section bundles related cases so a tester can stay logged into one persona before switching.
- Every case has: **ID**, **Area**, **Preconditions**, **Steps**, **Expected result**, **Type** (`manual` / `automated` / `both`).
- "Automated" means a candidate for Vitest / Playwright; the only existing automated coverage today is `tests/scoring.test.ts` (`pnpm test`). Everything else is manual unless the team wires up Playwright.
- "Both" means the rule is already covered by a unit/integration test, but a manual confirmation should also happen against the deployed build.
- Personas needed (see Blockers at the end):
  - **AnonU** — no session.
  - **NewUserA** — fresh account, no `display_name` yet.
  - **PlayerB / PlayerC / PlayerD** — three onboarded players for leaderboard ordering and tie-breaker cases.
  - **AdminX** — `profiles.is_admin = true`.
- Where a step says "use SQL", the operator opens the Supabase SQL editor for project `pabzhdozyoepvjeqxega` and runs the snippet.
- Use a **dedicated, throwaway** match (status `scheduled`, kickoff far in the future) for any test that mutates data. Never test against a real upcoming WC fixture once real picks are in.

---

## Section 1 — Authentication

Covers spec: `accounts/spec.md` → "User registration and sign-in", "Session management".

### TC-AUTH-01
- **Area:** Auth — Magic-link happy path
- **Preconditions:** AnonU on a clean browser, no Supabase cookies.
- **Steps:**
  1. Open `/sign-in`.
  2. Enter a deliverable email (`tester+magic@example.com`).
  3. Click **Send magic link**.
  4. Open the email, click the link.
- **Expected result:** UI swaps to "Check your email…" confirmation. The email arrives within ~30 s. The link routes through `/auth/callback?code=…` and lands on `/matches` (or `/onboarding` if first sign-in). `auth.users` row created and a `profiles` row exists for the user (verify via SQL: `select id, display_name, is_admin from public.profiles where id = '<uid>'`).
- **Type:** manual

### TC-AUTH-02
- **Area:** Auth — Magic-link malformed email rejected client-side
- **Preconditions:** AnonU on `/sign-in`.
- **Steps:**
  1. Type `not-an-email` into the email input.
  2. Submit.
- **Expected result:** A toast `Enter a valid email address` appears (sign-in-form.tsx line 22 short-circuits before calling Supabase). No network request to `/auth/v1/otp`. No email sent. Form remains editable.
- **Type:** manual

### TC-AUTH-03
- **Area:** Auth — Magic-link with Supabase API error
- **Preconditions:** AnonU. Temporarily simulate by entering an obviously rate-limited address (or rapid-fire 6 requests in <60 s).
- **Steps:**
  1. Submit valid email repeatedly until Supabase returns an error.
- **Expected result:** Toast surfaces the Supabase error message verbatim (e.g. "Email rate limit exceeded"). No "check your email" confirmation appears.
- **Type:** manual

### TC-AUTH-04
- **Area:** Auth — Magic-link callback error path
- **Preconditions:** Manually craft a request `GET /auth/callback?code=invalidcode`.
- **Steps:**
  1. Visit the URL above in a browser.
- **Expected result:** Server exchanges the code, fails, redirects to `/sign-in?error=<encoded message>` (per `app/auth/callback/route.ts` lines 12–16). Sign-in page renders without a logged-in nav.
- **Type:** manual

### TC-AUTH-05
- **Area:** Auth — Session persists across reload
- **Preconditions:** PlayerB signed in.
- **Steps:**
  1. Load `/matches`. Verify "Sign out" button visible.
  2. Hard reload (⌘+Shift+R).
  3. Open a new tab → `/leaderboard`.
- **Expected result:** Both pages render in signed-in state without a redirect to `/sign-in`. `sb-*-auth-token` cookies still present in DevTools.
- **Type:** manual

### TC-AUTH-06
- **Area:** Auth — Sign-out clears cookies
- **Preconditions:** PlayerB signed in on `/matches`.
- **Steps:**
  1. Click **Sign out** in the nav (POSTs to `/sign-out`).
  2. Land on `/`.
  3. Reload `/matches`.
- **Expected result:** Redirects to `/` (303 from `app/(auth)/sign-out/route.ts`). `sb-*-auth-token` cookies cleared. `/matches` still loads (public) but the nav now shows **Sign in** instead of **Sign out / My picks / Admin**.
- **Type:** manual

### TC-AUTH-07
- **Area:** Auth — Unauthenticated user redirected from `/my-picks`
- **Preconditions:** AnonU.
- **Steps:**
  1. Visit `/my-picks` directly.
- **Expected result:** Redirects to `/sign-in` (per `app/(app)/layout.tsx` line 11 and `app/(app)/my-picks/page.tsx` line 18). After successful sign-in the user lands on `/matches` (the layout doesn't preserve `next` here — see TC-AUTH-08 for the case that does).
- **Type:** manual

### TC-AUTH-08
- **Area:** Auth — `?next=` round-trip from match detail
- **Preconditions:** AnonU.
- **Steps:**
  1. Visit `/matches/<some-uuid>`.
  2. Click the **Sign in** CTA inside "Your prediction" panel (links to `/sign-in?next=/matches/<id>`).
  3. Complete magic-link auth.
- **Expected result:** After callback, browser redirects back to `/matches/<id>` (because `app/(auth)/sign-in/page.tsx` reads `next`).
- **Type:** manual

### TC-AUTH-09
- **Area:** Auth — Already-signed-in user visits `/sign-in`
- **Preconditions:** PlayerB signed in.
- **Steps:**
  1. Navigate to `/sign-in`.
- **Expected result:** Server-side redirect to `/matches` (sign-in/page.tsx line 19). Form never renders.
- **Type:** manual

---

## Section 2 — Onboarding (display name)

Covers spec: `accounts/spec.md` → "Profile and display name".

### TC-ONB-01
- **Area:** Onboarding — Forced on first sign-in
- **Preconditions:** Brand-new account NewUserA, `profiles.display_name IS NULL`.
- **Steps:**
  1. Sign in via magic link.
- **Expected result:** Lands on `/onboarding` (forced by `app/(app)/layout.tsx` line 21 once they hit any `(app)` route, or directly from the form). Cannot reach `/my-picks` until display name is saved.
- **Type:** manual

### TC-ONB-02
- **Area:** Onboarding — Save valid name (boundary 2 chars)
- **Preconditions:** NewUserA on `/onboarding`.
- **Steps:**
  1. Enter `Al` (exactly 2 chars).
  2. Submit.
- **Expected result:** `setDisplayName` server action writes `Al` to `profiles.display_name`, redirects to `/matches`. Nav surfaces no special name yet (nav doesn't show name; verify on `/leaderboard` after a score, or via SQL).
- **Type:** manual

### TC-ONB-03
- **Area:** Onboarding — Save valid name (boundary 32 chars)
- **Preconditions:** NewUserA, profile cleared (`update profiles set display_name = null where id = '<uid>'`).
- **Steps:**
  1. Enter exactly 32 chars (e.g. `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`).
  2. Submit.
- **Expected result:** Saves, redirect to `/matches`. SQL confirms 32-char name. DB check `char_length(display_name) between 2 and 32` (migration line 18) is the backstop.
- **Type:** manual

### TC-ONB-04
- **Area:** Onboarding — Reject 1 char
- **Preconditions:** NewUserA, profile cleared.
- **Steps:**
  1. Enter `A` (browser may block via `minLength={2}`; bypass with DevTools `removeAttribute('minlength')` then submit).
- **Expected result:** Server action throws `Display name must be 2–32 characters.` (onboarding/actions.ts line 16). Next.js renders `app/error.tsx` with that message. DB unchanged.
- **Type:** manual

### TC-ONB-05
- **Area:** Onboarding — Reject 33 chars
- **Preconditions:** NewUserA, profile cleared.
- **Steps:**
  1. Bypass `maxLength` and submit a 33-char string.
- **Expected result:** Same error path as TC-ONB-04. DB unchanged.
- **Type:** manual

### TC-ONB-06
- **Area:** Onboarding — Whitespace-only rejected after trim
- **Preconditions:** NewUserA, profile cleared.
- **Steps:**
  1. Submit `   ` (three spaces) or `  a  ` (boundary case after trim).
- **Expected result:** `   ` → after `z.string().trim()` becomes `""` → fails `min(2)` → error thrown. `  a  ` → trims to `a` (1 char) → also fails. DB unchanged.
- **Type:** manual

### TC-ONB-07
- **Area:** Onboarding — Already-onboarded user bounced
- **Preconditions:** PlayerB has `display_name = 'PlayerB'`.
- **Steps:**
  1. Visit `/onboarding` directly.
- **Expected result:** Redirects to `/matches` (page.tsx line 23). Form never renders.
- **Type:** manual

### TC-ONB-08
- **Area:** Onboarding — Unauthenticated visit
- **Preconditions:** AnonU.
- **Steps:**
  1. Visit `/onboarding`.
- **Expected result:** Redirects to `/sign-in` (page.tsx line 15).
- **Type:** manual

### TC-ONB-09
- **Area:** Onboarding — Edit display name later
- **Preconditions:** PlayerB signed in.
- **Steps:**
  1. There is currently **no UI** to edit display name post-onboarding (verify by inspecting nav and `/my-picks`).
- **Expected result:** Either confirm absence (then file as a known gap) or, if a profile page exists, update name to a new valid 2–32 value and check it appears on `/leaderboard` rows. **Spec requires** this capability (`accounts/spec.md` "Edit display name later"); this is a likely gap to surface.
- **Type:** manual
- **Note:** Surface as a gap if no UI exists.

---

## Section 3 — Matches list & detail

Covers spec: `matches/spec.md` → "Match catalog".

### TC-MATCH-01
- **Area:** Matches — Public list ordered by kickoff ascending
- **Preconditions:** AnonU. 104 matches seeded.
- **Steps:**
  1. Visit `/matches`.
- **Expected result:** Header reads "All 104 matches. Predictions lock at kickoff." Matches are grouped under `<h2>` per UTC calendar day, ordered by `kickoff_at` ascending (matches/page.tsx line 14). Each row shows stage badge + group code, kickoff time, teams, optional venue, and final score (if status = final) or status label.
- **Type:** manual

### TC-MATCH-02
- **Area:** Matches — Day grouping uses UTC date (current behaviour)
- **Preconditions:** Use SQL to confirm a fixture whose `kickoff_at` is 23:30 UTC (which would be next-day in west-of-UTC zones).
- **Steps:**
  1. Visit `/matches` from a browser in `America/Los_Angeles`.
  2. Inspect which `<h2>` heading the late-UTC kickoff sits under.
- **Expected result:** Page groups by **UTC date** (`utcDateKey` = `iso.slice(0, 10)`, `lib/match-utils.ts` line 44). Heading itself is rendered in local TZ via `<LocalTime format="date">`, so a UTC-grouped header may display the previous local day. Confirm this matches design intent — flag if spec scenario "Match groups by tournament day in user's tz" is expected for this page (the spec scenario is satisfied by the leaderboard `tz` flow, not the matches list).
- **Type:** manual

### TC-MATCH-03
- **Area:** Matches — Kickoff time localized client-side
- **Preconditions:** AnonU on a fresh page load.
- **Steps:**
  1. Open DevTools → Sensors → set a non-default time zone (`Europe/Madrid`).
  2. Reload `/matches`.
- **Expected result:** Initial server HTML shows kickoff in UTC; after hydration `<LocalTime>` swaps to `Europe/Madrid`. No layout shift other than the time label re-render.
- **Type:** manual

### TC-MATCH-04
- **Area:** Matches — Empty fixture list state
- **Preconditions:** Stage a copy of the database (or use a preview Supabase project) with the `matches` table truncated.
- **Steps:**
  1. Visit `/matches`.
- **Expected result:** "No matches loaded yet. An admin needs to seed the fixture list." panel renders. Page does not crash.
- **Type:** manual

### TC-MATCH-05
- **Area:** Matches — Detail page renders fixture
- **Preconditions:** AnonU. Pick any `matchId` from `/matches`.
- **Steps:**
  1. Click a match row.
- **Expected result:** Lands on `/matches/<id>`. Shows stage + status badge, "Home vs Away" headline, kickoff localized via `<LocalTime>`, venue (if any). For unauthenticated visitors, "Your prediction" panel shows a CTA "Sign in" linking to `/sign-in?next=/matches/<id>`.
- **Type:** manual

### TC-MATCH-06
- **Area:** Matches — 404 for unknown match id
- **Preconditions:** AnonU.
- **Steps:**
  1. Visit `/matches/00000000-0000-0000-0000-000000000000`.
- **Expected result:** `notFound()` triggers (page.tsx line 23) → renders the global `app/not-found.tsx`.
- **Type:** manual

### TC-MATCH-07
- **Area:** Matches — Detail page for a `final` match
- **Preconditions:** Use SQL to set status='final', home_score=2, away_score=1 on a test match.
- **Steps:**
  1. Visit that match's detail page.
- **Expected result:** Status badge reads "Final" (variant `default`). A "Final score" panel renders with `2 – 1`. Prediction form is replaced by the read-only "Your pick was X-Y. Predictions are locked at kickoff." text (or "Predictions are locked — kickoff has passed and you didn't submit one for this match." if no pick).
- **Type:** manual

### TC-MATCH-08
- **Area:** Matches — Public vs signed-in nav differences
- **Preconditions:** Same browser, two sessions.
- **Steps:**
  1. AnonU loads `/matches` → note nav links.
  2. PlayerB loads `/matches` → note nav links.
  3. AdminX loads `/matches` → note nav links.
- **Expected result:** AnonU sees `Matches | Leaderboard | Sign in`. PlayerB also sees `My picks` and `Sign out`. AdminX additionally sees `Admin` (site-nav.tsx lines 34–43).
- **Type:** manual

---

## Section 4 — Predictions

Covers spec: `predictions/spec.md`.

### TC-PRED-01
- **Area:** Predictions — Submit first prediction
- **Preconditions:** PlayerB signed in. Test match with `kickoff_at` >24 h in the future.
- **Steps:**
  1. Open `/matches/<id>`.
  2. Enter `2` and `1`.
  3. Click **Submit pick**.
- **Expected result:** Toast `Prediction saved`. Inserts a row in `predictions` (`select * from predictions where user_id = '<uid>' and match_id = '<id>'` returns one row). `revalidatePath('/matches/<id>')` and `revalidatePath('/my-picks')` fire.
- **Type:** manual

### TC-PRED-02
- **Area:** Predictions — Edit existing prediction
- **Preconditions:** TC-PRED-01 succeeded.
- **Steps:**
  1. Reload the same match page; form pre-fills with `2 – 1`.
  2. Change to `3 – 0`. Click **Update pick**.
- **Expected result:** Toast `Prediction saved`. SQL shows the existing row updated; `submitted_at` refreshed to `now()` (actions.ts line 36 sets it explicitly). The `predictions` table still has only one row for `(user_id, match_id)`.
- **Type:** manual

### TC-PRED-03
- **Area:** Predictions — Boundary scores 0 and 20
- **Preconditions:** PlayerB on a future test match.
- **Steps:**
  1. Submit `0` `0`. Verify toast.
  2. Submit `20` `20`. Verify toast.
- **Expected result:** Both accepted. SQL confirms both saved. (`home_goals between 0 and 20` check at DB; `z.number().int().min(0).max(20)` at server.)
- **Type:** both — DB constraint already validated by the migration; surface a Vitest case for the server action's Zod schema.

### TC-PRED-04
- **Area:** Predictions — Reject negative goals
- **Preconditions:** PlayerB on a future test match.
- **Steps:**
  1. In DevTools, remove `min={0}` from the input, type `-1` for home, `0` for away. Submit.
- **Expected result:** Server action returns `{ ok: false, error: "Scores must be whole numbers between 0 and 20." }` and toast surfaces it. Even if Zod were bypassed, DB check would refuse.
- **Type:** manual

### TC-PRED-05
- **Area:** Predictions — Reject >20 goals
- **Preconditions:** PlayerB.
- **Steps:**
  1. Bypass `max={20}`, submit `25` `0`.
- **Expected result:** Same friendly error toast as TC-PRED-04.
- **Type:** manual

### TC-PRED-06
- **Area:** Predictions — Reject non-integer
- **Preconditions:** PlayerB.
- **Steps:**
  1. Call the server action directly via DevTools console with `{ matchId, homeGoals: 1.5, awayGoals: 0 }` (use the network panel to copy the action call signature, or run via `await fetch(...)`).
- **Expected result:** `z.number().int()` rejects → friendly error toast.
- **Type:** manual

### TC-PRED-07
- **Area:** Predictions — RLS lock at kickoff (DB-level)
- **Preconditions:** Create a test match with `kickoff_at = now() - interval '1 minute'` via SQL.
- **Steps:**
  1. PlayerB attempts to call `submitPrediction` with valid scores against that match (use console call or the regular form before the lock-check refresh).
- **Expected result:** Supabase returns error code `42501` / message containing "row-level security". Server action maps it to `{ ok: false, error: "Predictions are locked — kickoff has passed." }` (actions.ts line 42–44). Toast surfaces that exact wording.
- **Type:** manual — critical security path; consider an automated Supabase integration test.

### TC-PRED-08
- **Area:** Predictions — UI disables form at kickoff (client tick)
- **Preconditions:** Create a test match with `kickoff_at = now() + interval '30 seconds'`.
- **Steps:**
  1. Open the match page just before kickoff.
  2. Watch the form tick over.
- **Expected result:** At/after kickoff, the inputs and submit button become `disabled`, helper text reads `Locked at kickoff` (prediction-form.tsx lines 28–34, 91, 93). DB-level lock still applies even if client clock is wrong.
- **Type:** manual

### TC-PRED-09
- **Area:** Predictions — Other users' picks hidden before kickoff
- **Preconditions:** PlayerB and PlayerC both submit on the same future match. Use SQL as PlayerC's auth context (or via Supabase REST with PlayerC's JWT).
- **Steps:**
  1. As PlayerC, query `select home_goals, away_goals from predictions where match_id = '<id>' and user_id != auth.uid();`.
- **Expected result:** Returns 0 rows (RLS `predictions_select_own` only). Spec scenario "Other users' picks hidden before kickoff" satisfied.
- **Type:** manual

### TC-PRED-10
- **Area:** Predictions — Other users' picks visible after final
- **Preconditions:** Match with `status='final'`, multiple users have picks for it.
- **Steps:**
  1. As PlayerC (signed in), query the same SQL as TC-PRED-09 against the final match.
- **Expected result:** Returns all rows for that match (RLS `predictions_select_after_final` policy). UI does not currently surface other players' picks per match — confirm absence and decide whether to ship a "Match results" reveal page.
- **Type:** manual

### TC-PRED-11
- **Area:** Predictions — Unauthenticated submit blocked
- **Preconditions:** AnonU.
- **Steps:**
  1. From the match detail page, the form is hidden behind a "Sign in" CTA. Try invoking `submitPrediction` via console.
- **Expected result:** Server action returns `{ ok: false, error: "You need to be signed in to submit a prediction." }` (actions.ts line 27).
- **Type:** manual

### TC-PRED-12
- **Area:** Predictions — Submit for unknown match id
- **Preconditions:** PlayerB.
- **Steps:**
  1. Call `submitPrediction({ matchId: '00000000-0000-0000-0000-000000000000', homeGoals: 1, awayGoals: 1 })`.
- **Expected result:** RLS `predictions_insert_own_before_kickoff` exists check fails → `42501` → mapped to "Predictions are locked" toast (current code maps any 42501 to that message). Acceptable; flag if a more specific "Match not found" is desired.
- **Type:** manual

### TC-PRED-13
- **Area:** Predictions — `/my-picks` lists own picks ordered by kickoff
- **Preconditions:** PlayerB has 3+ picks across different days.
- **Steps:**
  1. Visit `/my-picks`.
- **Expected result:** All picks listed, ordered by `matches.kickoff_at` ascending (`my-picks/page.tsx` line 24). Each row shows kickoff, teams, "Your pick: X-Y", final result if available, and a points/hit_type badge or status. "Edit" link visible only when `isLocked(m) === false`.
- **Type:** manual

### TC-PRED-14
- **Area:** Predictions — Empty `/my-picks`
- **Preconditions:** Fresh user PlayerD with 0 predictions.
- **Steps:**
  1. Visit `/my-picks`.
- **Expected result:** "You haven't submitted any predictions yet. Pick some matches." panel with link to `/matches`.
- **Type:** manual

---

## Section 5 — Scoring rules (end-to-end)

Covers spec: `scoring/spec.md`. Unit tests for the pure scoring function already live in `tests/scoring.test.ts`; this section verifies the **trigger + leaderboard** path end-to-end.

### TC-SCORE-01
- **Area:** Scoring — `exact` (5 pts)
- **Preconditions:** AdminX. Test match `M1` with three predictions: PlayerB `2-1`, PlayerC `3-2`, PlayerD `2-0`.
- **Steps:**
  1. AdminX opens `/admin/matches`, finds `M1`.
  2. Sets home=2, away=1, status=final, **Save result**.
  3. SQL: `select user_id, points, hit_type from scores where match_id = '<M1>'`.
- **Expected result:** PlayerB row: `points=5, hit_type='exact'`. (PlayerC = 3 winner_gd, PlayerD = 1 winner — also verify.) Match detail page shows final score, leaderboard updates within one request.
- **Type:** both — TS replica covered by `tests/scoring.test.ts`; verify SQL trigger end-to-end.

### TC-SCORE-02
- **Area:** Scoring — `winner_gd` non-zero (3 pts)
- **Preconditions:** Continuation of TC-SCORE-01.
- **Steps:**
  1. From the SQL above, inspect PlayerC's row.
- **Expected result:** `points=3, hit_type='winner_gd'` (predicted 3-2, actual 2-1: same winner Home, same goal diff +1).
- **Type:** both

### TC-SCORE-03
- **Area:** Scoring — `winner_gd` draw case
- **Preconditions:** Test match `M2`. PlayerB predicts `1-1`. AdminX enters final `2-2`.
- **Steps:**
  1. Save result, verify SQL.
- **Expected result:** PlayerB row: `points=3, hit_type='winner_gd'` (draw matches sign 0 and goal diff 0).
- **Type:** both

### TC-SCORE-04
- **Area:** Scoring — `winner` only (1 pt)
- **Preconditions:** Test match `M3`. PlayerB predicts `2-0`. AdminX enters final `3-1`.
- **Steps:**
  1. Save result, verify SQL.
- **Expected result:** PlayerB row: `points=1, hit_type='winner'`.
- **Type:** both

### TC-SCORE-05
- **Area:** Scoring — `miss` (0 pts)
- **Preconditions:** Test match `M4`. PlayerB predicts `2-1`. AdminX enters final `1-2`.
- **Steps:**
  1. Save result, verify SQL.
- **Expected result:** PlayerB row: `points=0, hit_type='miss'`.
- **Type:** both

### TC-SCORE-06
- **Area:** Scoring — Recompute on result correction
- **Preconditions:** TC-SCORE-01 has run; `M1` has scores rows.
- **Steps:**
  1. AdminX opens `M1`, changes to home=3, away=0, **Save result** again.
  2. SQL: re-query `scores` for `M1`.
- **Expected result:** Rows replaced (delete + insert in `compute_match_scores`). PlayerB now `winner` (1 pt), PlayerC `winner` (1 pt), PlayerD `winner` (1 pt). `computed_at` updated to the new `now()`.
- **Type:** manual

### TC-SCORE-07
- **Area:** Scoring — Idempotent recompute via "Force recompute"
- **Preconditions:** TC-SCORE-06 just ran; capture the current `scores` rows for `M1` including `points` and `hit_type`.
- **Steps:**
  1. Click **Force recompute scores** on `M1`.
  2. Re-query `scores` for `M1`.
- **Expected result:** Same `points` and `hit_type` per user (idempotent). `computed_at` refreshed.
- **Type:** manual

### TC-SCORE-08
- **Area:** Scoring — Cancellation removes scores
- **Preconditions:** `M1` has scores rows.
- **Steps:**
  1. AdminX edits `M1`: status=cancelled (leave scores filled or null them).
  2. Save.
  3. SQL `select count(*) from scores where match_id = '<M1>'`.
- **Expected result:** `count = 0`. The trigger fires on status change, `compute_match_scores` early-returns when `status <> 'final'`, leaving an empty scores set after the leading `delete`.
- **Type:** manual

### TC-SCORE-09
- **Area:** Scoring — Nulling final score also clears scores
- **Preconditions:** `M1` has status='final'.
- **Steps:**
  1. AdminX edits `M1`: clear home_score and away_score, set status=scheduled.
  2. Save.
  3. SQL `select count(*) from scores where match_id = '<M1>'`.
- **Expected result:** `count = 0`. Scoring trigger early-returns on missing final scores.
- **Type:** manual

### TC-SCORE-10
- **Area:** Scoring — No scores while status != 'final'
- **Preconditions:** Test match `M5` with predictions but `status='scheduled'`.
- **Steps:**
  1. SQL: `select count(*) from scores where match_id = '<M5>'`.
- **Expected result:** `0`. (Confirms `scoring/spec.md` "Predictions without scores".)
- **Type:** manual

### TC-SCORE-11
- **Area:** Scoring — `scores` table not directly writable
- **Preconditions:** PlayerB JWT.
- **Steps:**
  1. Try `insert into scores (user_id, match_id, points, hit_type) values ('<uid>', '<mid>', 100, 'exact');` via Supabase REST as PlayerB.
- **Expected result:** RLS denies (no insert/update/delete policies on `scores`; only `compute_match_scores` security-definer function writes). Returns 401/403 / RLS error.
- **Type:** manual

---

## Section 6 — Admin

Covers spec: `accounts/spec.md` "Admin role" and `matches/spec.md` "Admin manages fixtures" / "Admin enters final score".

### TC-ADMIN-01
- **Area:** Admin — Nav surfaces "Admin" link only for admins
- **Preconditions:** AdminX has `is_admin = true`. PlayerB does not.
- **Steps:**
  1. Sign in as AdminX, observe nav.
  2. Sign in as PlayerB, observe nav.
- **Expected result:** AdminX sees the "Admin" link (site-nav.tsx line 39); PlayerB does not.
- **Type:** manual

### TC-ADMIN-02
- **Area:** Admin — Layout 403 for non-admin
- **Preconditions:** PlayerB signed in.
- **Steps:**
  1. Visit `/admin/matches` directly.
- **Expected result:** Layout renders the "403 — Admin only" panel (admin/layout.tsx lines 18–30). No fixture list rendered.
- **Type:** manual

### TC-ADMIN-03
- **Area:** Admin — Layout redirects unauthenticated to sign-in with next param
- **Preconditions:** AnonU.
- **Steps:**
  1. Visit `/admin/matches`.
- **Expected result:** Redirect to `/sign-in?next=/admin/matches` (admin/layout.tsx line 10).
- **Type:** manual

### TC-ADMIN-04
- **Area:** Admin — Create fixture
- **Preconditions:** AdminX on `/admin/matches`.
- **Steps:**
  1. Fill **New fixture**: stage=group, group=A, home=Mexico, away=Canada, kickoff = today + 30 days, venue=Estadio Azteca.
  2. Click **Create fixture**.
- **Expected result:** New `matches` row inserted (`status='scheduled'`, scores null). Page revalidates and the fixture appears in the list, sorted into kickoff position. `revalidateTag('leaderboard', 'max')` fires (verified by leaderboard refresh in TC-LB-09).
- **Type:** manual

### TC-ADMIN-05
- **Area:** Admin — Create fixture rejects past kickoff
- **Preconditions:** AdminX.
- **Steps:**
  1. New fixture with kickoff = yesterday.
- **Expected result:** Server action throws `Kickoff must be in the future for new fixtures` (actions.ts lines 73–75) → renders `app/error.tsx`.
- **Type:** manual

### TC-ADMIN-06
- **Area:** Admin — Create fixture rejects same home/away team
- **Preconditions:** AdminX.
- **Steps:**
  1. New fixture, home=Brazil, away=Brazil.
- **Expected result:** Server action throws `Home and away teams must differ` (actions.ts line 65). Even if bypassed, DB check `away_team <> home_team` (migration line 26) refuses.
- **Type:** manual

### TC-ADMIN-07
- **Area:** Admin — Edit kickoff before kickoff
- **Preconditions:** AdminX. Pick a future test fixture.
- **Steps:**
  1. (No inline "edit kickoff" form is visible on `/admin/matches`; this UI is fixture-create only. To test the spec scenario, either patch via SQL or extend the form.)
- **Expected result:** If extended: updating `kickoff_at` to a new future time leaves predictions editable until the new kickoff. Otherwise, surface as a UX gap and verify via SQL that the trigger does not lock predictions early.
- **Type:** manual
- **Note:** Current admin UI has no per-row edit-kickoff form. Spec scenario "Admin edits kickoff time before kickoff" is only testable via SQL today.

### TC-ADMIN-08
- **Area:** Admin — Save result happy path
- **Preconditions:** AdminX. Future test fixture with two predictions.
- **Steps:**
  1. Fill home=2, away=1. Status=final. **Save result**.
- **Expected result:** Match row updated. Scores recomputed (TC-SCORE-01 verifies points). `revalidatePath('/matches/<id>' | '/matches' | '/leaderboard')` and `revalidateTag('leaderboard', 'max')` fire.
- **Type:** manual

### TC-ADMIN-09
- **Area:** Admin — Status `live` does not score
- **Preconditions:** AdminX.
- **Steps:**
  1. Set status=live, leave scores blank or set them. Save.
  2. SQL: `select count(*) from scores where match_id = '<id>'`.
- **Expected result:** `count = 0` because `compute_match_scores` only inserts when `status='final'`.
- **Type:** manual

### TC-ADMIN-10
- **Area:** Admin — Force recompute (when result already entered)
- **Preconditions:** Final-state match with scores.
- **Steps:**
  1. Click **Force recompute scores**.
- **Expected result:** Same outcome as TC-SCORE-07. RPC succeeds, leaderboard cache invalidated.
- **Type:** manual

### TC-ADMIN-11
- **Area:** Admin — Delete fixture cascades
- **Preconditions:** AdminX. A test fixture with predictions and (optionally) scores.
- **Steps:**
  1. Click **Delete fixture**.
  2. SQL: confirm `predictions` and `scores` rows for that match are gone (FK `on delete cascade`).
- **Expected result:** Fixture row gone, child rows gone, leaderboard cache invalidated. Page revalidates.
- **Type:** manual

### TC-ADMIN-12
- **Area:** Admin — Server-action 403 even if route was reached somehow
- **Preconditions:** PlayerB. Use the same `formData` as TC-ADMIN-04 but call `saveFixture` directly (e.g. via DevTools fetching the action endpoint).
- **Steps:**
  1. Invoke the server action with a non-admin session.
- **Expected result:** `assertAdmin()` (actions.ts lines 39–51) throws `Admin only` (or `Not signed in` for AnonU). Renders `app/error.tsx`. RLS additionally would deny.
- **Type:** manual

### TC-ADMIN-13
- **Area:** Admin — RLS denies non-admin direct DB writes
- **Preconditions:** PlayerB JWT.
- **Steps:**
  1. As PlayerB via Supabase REST: `insert into matches (...)`.
- **Expected result:** RLS policy `matches_admin_write` (using `is_admin()` helper) denies the write.
- **Type:** manual

### TC-ADMIN-14
- **Area:** Admin — `is_admin` cannot be self-promoted
- **Preconditions:** PlayerB JWT.
- **Steps:**
  1. As PlayerB via Supabase REST: `update profiles set is_admin = true where id = auth.uid();`.
- **Expected result:** Trigger `trg_profiles_guard_is_admin` raises `is_admin cannot be changed via the user API`.
- **Type:** manual

---

## Section 7 — Leaderboard

Covers spec: `leaderboard/spec.md`.

### TC-LB-01
- **Area:** Leaderboard — Default view = today
- **Preconditions:** AnonU. At least one final match with `kickoff_at` falling on today (in tester's TZ).
- **Steps:**
  1. Visit `/leaderboard` (no query params).
- **Expected result:** Tab "Today" is active. Date input pre-fills with today (resolved via `tz` cookie if set, else UTC). Rows reflect `leaderboard_for_day(today, tz)`.
- **Type:** manual

### TC-LB-02
- **Area:** Leaderboard — Timezone cookie set on first load
- **Preconditions:** AnonU, no `tz` cookie.
- **Steps:**
  1. Visit `/leaderboard`.
  2. Inspect `document.cookie`.
- **Expected result:** `TimezoneCookie` writes a `tz=` cookie containing `Intl.DateTimeFormat().resolvedOptions().timeZone` with `max-age=1y`, `path=/`, `samesite=lax` (timezone-cookie.tsx).
- **Type:** manual

### TC-LB-03
- **Area:** Leaderboard — UTC fallback when no cookie
- **Preconditions:** AnonU, manually delete `tz` cookie. Block JS so the cookie is never written (e.g. NoScript) — or hit the page directly with curl: `curl -i 'https://world-cup-pool-sepia.vercel.app/leaderboard'`.
- **Steps:**
  1. Inspect server-rendered HTML's pre-fill date.
- **Expected result:** Server uses `tz = 'UTC'` (page.tsx line 40), today resolved as UTC date.
- **Type:** manual

### TC-LB-04
- **Area:** Leaderboard — Date picker for past day
- **Preconditions:** AnonU. A past day with at least one final match.
- **Steps:**
  1. On `/leaderboard?scope=today`, set the date input to that past date and click **Go**.
- **Expected result:** URL updates to `?scope=today&date=YYYY-MM-DD`. Rows reflect `leaderboard_for_day(date, tz)` for that day. Other days' results are excluded.
- **Type:** manual

### TC-LB-05
- **Area:** Leaderboard — Day with no final matches → empty state
- **Preconditions:** A future or empty day.
- **Steps:**
  1. Pick that date in the picker.
- **Expected result:** Renders "No completed matches on this day." panel.
- **Type:** manual

### TC-LB-06
- **Area:** Leaderboard — Overall ordering
- **Preconditions:** Multiple users have scored across multiple final matches.
- **Steps:**
  1. Visit `/leaderboard?scope=overall`.
  2. SQL: `select * from v_leaderboard_overall order by rank;`.
- **Expected result:** UI rows match the SQL view, ordered by `total_points desc, exact_hits desc, winner_gd_hits desc, first_submit asc`. Only users with at least one `scores` row appear.
- **Type:** manual

### TC-LB-07
- **Area:** Leaderboard — Tie-breaker by exact hits
- **Preconditions:** Craft seed: PlayerB and PlayerC both have `total_points=10`. PlayerB has 1 exact hit; PlayerC has 0. SQL helper:
  ```sql
  -- Adjust to your fixture ids
  insert into matches (id, stage, home_team, away_team, kickoff_at, status, home_score, away_score)
  values (gen_random_uuid(), 'group', 'TestA', 'TestB', now() - interval '2 days', 'final', 2, 1);
  ```
  Then craft predictions so the totals come out 10/10 with the desired exact-hit split.
- **Steps:**
  1. Visit `/leaderboard?scope=overall`.
- **Expected result:** PlayerB ranks above PlayerC. SQL `v_leaderboard_overall` agrees.
- **Type:** manual

### TC-LB-08
- **Area:** Leaderboard — Tie-breaker by winner_gd hits
- **Preconditions:** Craft seed where two users tie on points and exact hits but differ on `winner_gd` count.
- **Steps:**
  1. Visit `/leaderboard?scope=overall`.
- **Expected result:** Higher `winner_gd_hits` ranks higher.
- **Type:** manual

### TC-LB-09
- **Area:** Leaderboard — Tie-breaker by submission timestamp
- **Preconditions:** Craft seed where two users tie on points, exact, and winner_gd. Ensure `predictions.submitted_at` differs on at least one counted prediction. SQL: `update predictions set submitted_at = now() - interval '2 days' where user_id = '<PlayerB>' and match_id = '<...>';`.
- **Steps:**
  1. Visit `/leaderboard?scope=overall`.
- **Expected result:** Earlier `min(submitted_at)` wins → PlayerB ranks above PlayerC. (View uses `min(p.submitted_at) as first_submit` and orders ascending.)
- **Type:** manual

### TC-LB-10
- **Area:** Leaderboard — "Not yet ranked" summary for signed-in user
- **Preconditions:** PlayerD signed in, has predictions but no scored final match.
- **Steps:**
  1. Visit `/leaderboard?scope=today` and `/leaderboard?scope=overall`.
- **Expected result:** Each view renders "You're **not yet ranked** in this scope." panel with a CTA. (page.tsx lines 141–151.)
- **Type:** manual

### TC-LB-11
- **Area:** Leaderboard — Self-row highlighted
- **Preconditions:** PlayerB has at least one scored row.
- **Steps:**
  1. Visit `/leaderboard?scope=overall` while signed in as PlayerB.
- **Expected result:** PlayerB's row uses `bg-primary/5 font-medium` styling and shows a `you` badge (page.tsx lines 124–129).
- **Type:** manual

### TC-LB-12
- **Area:** Leaderboard — Cache invalidation after admin score change
- **Preconditions:** Test match with three predictions, status=scheduled.
- **Steps:**
  1. As AnonU, view `/leaderboard?scope=overall`. Note current rows.
  2. As AdminX in a second window, save a final result for that match.
  3. Reload (or navigate away and back) `/leaderboard?scope=overall` as AnonU.
- **Expected result:** Standings update without manual cache-busting. `revalidateTag('leaderboard', 'max')` in `setMatchResult` (actions.ts line 111) is the mechanism. Page should reflect the new totals on the next request.
- **Type:** manual — critical caching path.

### TC-LB-13
- **Area:** Leaderboard — DST / cross-day kickoff in TZ
- **Preconditions:** A real kickoff at 23:00 UTC where, in TZ `America/Los_Angeles`, the local time is 16:00 (same day) but in TZ `Pacific/Auckland` it spills into the next day.
- **Steps:**
  1. Set browser TZ to `America/Los_Angeles`. Set date to that day. View `/leaderboard?scope=today`.
  2. Set browser TZ to `Pacific/Auckland`. Set date to the *next* day. View `/leaderboard?scope=today`.
- **Expected result:** Same match appears in the LA "today" view and in the Auckland "next-day" view. `leaderboard_for_day(d, tz)` correctly bounds via `(d::timestamp at time zone tz)`.
- **Type:** manual

### TC-LB-14
- **Area:** Leaderboard — Invalid `?date` query ignored
- **Preconditions:** AnonU.
- **Steps:**
  1. Visit `/leaderboard?scope=today&date=not-a-date`.
- **Expected result:** Server falls back to `todayInTz(tz)` (page.tsx line 41 regex check). Page renders today's standings.
- **Type:** manual

---

## Section 8 — Negative paths & error handling

### TC-ERR-01
- **Area:** Error — Server action throws bubbles to error.tsx
- **Preconditions:** Force a failure: e.g. AdminX submits the New Fixture form with a malformed `kickoff_at` ISO string (bypass `datetime-local`).
- **Steps:**
  1. POST the form with `kickoff_at=not-a-date`.
- **Expected result:** Zod refine fails → `Invalid timestamp` thrown → `app/error.tsx` renders with the message and a "Try again" button + Home link. `console.error(error)` runs in dev tools.
- **Type:** manual

### TC-ERR-02
- **Area:** Error — Network failure when submitting prediction
- **Preconditions:** PlayerB on a future match.
- **Steps:**
  1. Open DevTools → Network → set Offline.
  2. Submit the form.
- **Expected result:** `submitPrediction` rejects (fetch error). Toast surfaces an error (browser/Next.js fetch error message). UI does not optimistically apply the change. Re-enabling network and resubmitting succeeds.
- **Type:** manual

### TC-ERR-03
- **Area:** Error — RLS denial wording
- **Preconditions:** TC-PRED-07 path.
- **Steps:**
  1. Trigger any RLS rejection on `predictions`.
- **Expected result:** Toast reads exactly `Predictions are locked — kickoff has passed.` (actions.ts line 43). Confirm wording matches user-facing copy promised by spec.
- **Type:** manual

### TC-ERR-04
- **Area:** Error — Supabase down (load failure)
- **Preconditions:** Block `*.supabase.co` in DevTools or shut Supabase project off.
- **Steps:**
  1. Reload `/matches`.
- **Expected result:** Page renders the inline error: `Failed to load matches: <error.message>` (matches/page.tsx line 17). No crash, no stack trace shown.
- **Type:** manual

### TC-ERR-05
- **Area:** Error — Sign-out CSRF / GET attempt
- **Preconditions:** PlayerB signed in.
- **Steps:**
  1. Visit `/sign-out` via GET (browser address bar).
- **Expected result:** 405 Method Not Allowed (only POST handler defined). User remains signed in.
- **Type:** manual

### TC-ERR-06
- **Area:** Error — Console clean on every page
- **Preconditions:** Fresh Chrome with DevTools open. PlayerB signed in.
- **Steps:**
  1. Visit `/`, `/matches`, `/matches/<id>`, `/leaderboard`, `/leaderboard?scope=overall`, `/my-picks`, `/onboarding` (after clearing display name), `/admin/matches` (as AdminX).
- **Expected result:** No red console errors. Hydration warnings tolerable only if attributable to date formatting (document each one).
- **Type:** manual

### TC-ERR-07
- **Area:** Error — 404 page
- **Preconditions:** AnonU.
- **Steps:**
  1. Visit `/this-route-does-not-exist`.
- **Expected result:** `app/not-found.tsx` renders with a clear message and a link home.
- **Type:** manual

---

## Section 9 — Performance & build

### TC-PERF-01
- **Area:** Build — `pnpm build` clean
- **Preconditions:** Local checkout.
- **Steps:**
  1. From repo root run `pnpm install` then `pnpm build`.
- **Expected result:** Build exits 0 with no TS or ESLint errors, no Next.js missing-`'use client'` warnings, no "Dynamic server usage" warnings on routes that should be static, and reports route-by-route output (e.g. `/`, `/matches`, `/matches/[matchId]`, `/leaderboard`, `/admin/matches`, `/my-picks`, `/onboarding`, `/sign-in`).
- **Type:** automated (CI candidate)

### TC-PERF-02
- **Area:** Build — `pnpm typecheck` and `pnpm lint`
- **Steps:**
  1. `pnpm typecheck && pnpm lint`.
- **Expected result:** Both exit 0.
- **Type:** automated

### TC-PERF-03
- **Area:** Build — `pnpm test`
- **Steps:**
  1. `pnpm test`.
- **Expected result:** Vitest passes (currently `tests/scoring.test.ts`).
- **Type:** automated

### TC-PERF-04
- **Area:** Perf — Lighthouse mobile (production)
- **Preconditions:** Production URL, Chrome DevTools → Lighthouse.
- **Steps:**
  1. Run Lighthouse in mobile mode against `/`, `/matches`, `/leaderboard`.
- **Expected result:** Performance ≥ 80, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90 as a sanity baseline. Document scores; flag anything <80 with a follow-up task.
- **Type:** manual
- **Blocker note:** Treat the score as informational, not a gate, until thresholds are agreed.

### TC-PERF-05
- **Area:** Perf — Cold-start TTFB on `/leaderboard`
- **Preconditions:** Production. Wait until any cache is cold.
- **Steps:**
  1. `curl -w '%{time_starttransfer}\n' -o /dev/null -s 'https://world-cup-pool-sepia.vercel.app/leaderboard'` 3 times.
- **Expected result:** Median TTFB under ~800 ms in eu-west region. Track regressions.
- **Type:** manual

### TC-PERF-06
- **Area:** Perf — Match list with 104 fixtures
- **Steps:**
  1. View `/matches`. Scroll. Check FPS.
- **Expected result:** Smooth scroll, no obvious jank, single network request. The full list is server-rendered in one HTTP response (page.tsx fetches all matches at once).
- **Type:** manual

---

## Section 10 — Cross-browser smoke

### TC-XB-01
- **Area:** Cross-browser — Desktop Chrome
- **Steps:**
  1. Run TC-AUTH-01, TC-MATCH-01, TC-PRED-01, TC-LB-01 in latest Chrome (macOS or Windows).
- **Expected result:** All pass without visual regressions.
- **Type:** manual

### TC-XB-02
- **Area:** Cross-browser — Desktop Safari
- **Steps:**
  1. Same flows in latest Safari.
- **Expected result:** All pass. Cookie behaviour for the magic-link callback works (Safari has stricter ITP — verify Supabase auth cookies persist across tabs).
- **Type:** manual

### TC-XB-03
- **Area:** Cross-browser — Mobile Safari (iOS)
- **Steps:**
  1. Open production URL on iPhone (real device or BrowserStack). Run TC-AUTH-01 (magic link delivered to a real inbox), TC-MATCH-01, TC-PRED-01.
- **Expected result:** Layout is mobile-first and readable; tap targets ≥ 44 pt; number inputs trigger numeric keypad (`inputMode="numeric"` in prediction-form.tsx); leaderboard table doesn't overflow horizontally.
- **Type:** manual

### TC-XB-04
- **Area:** Cross-browser — Mobile Chrome (Android)
- **Steps:**
  1. Same flows on a recent Pixel.
- **Expected result:** Same as TC-XB-03.
- **Type:** manual

### TC-XB-05
- **Area:** Responsive — 320 px viewport
- **Steps:**
  1. DevTools → device toolbar → 320 × 568 (iPhone SE 1st gen).
  2. Walk: home → matches → match detail → leaderboard → my-picks → onboarding → admin (as admin).
- **Expected result:** No horizontal scrollbars (except the leaderboard table on Overall, which may scroll deliberately). Buttons remain reachable; inputs stack rather than overlap.
- **Type:** manual

### TC-XB-06
- **Area:** Accessibility — Keyboard nav
- **Steps:**
  1. Tab through `/sign-in`, prediction form, admin form. Submit using Enter.
- **Expected result:** Focus visible, logical order, all interactive elements reachable, no keyboard traps.
- **Type:** manual

### TC-XB-07
- **Area:** Accessibility — Screen-reader spot-check
- **Steps:**
  1. With VoiceOver, navigate `/matches` and `/leaderboard`.
- **Expected result:** Headings announced (`h1`, `h2`), `<Label>` and `<Input>` paired correctly (e.g. "Email, edit text"), table headers announced.
- **Type:** manual

---

## Section 11 — Operational/regression spot-checks

### TC-OP-01
- **Area:** Regression — `revalidateTag('leaderboard', 'max')` is honoured by Next.js 16
- **Steps:**
  1. After any admin write, capture network response headers from the next `/leaderboard` request — check `x-vercel-cache: MISS` (or framework's tag-cache header) on the first hit, `HIT` on the second.
- **Expected result:** First request after a tag invalidation is a MISS; the next is a HIT.
- **Type:** manual

### TC-OP-02
- **Area:** Regression — Middleware does not 500 anonymous traffic
- **Steps:**
  1. `curl -i 'https://world-cup-pool-sepia.vercel.app/'` 3 times (no cookies).
- **Expected result:** 200 each time. `middleware.ts` calls `supabase.auth.getUser()` even for anon — verify it doesn't blow up if cookies are missing.
- **Type:** manual

### TC-OP-03
- **Area:** Regression — `handle_new_user` trigger creates profile on signup
- **Steps:**
  1. Sign up a brand-new email.
  2. SQL: `select id from public.profiles where id = '<auth.users.id>'`.
- **Expected result:** Row exists with `display_name = null`, `is_admin = false`. (`trg_on_auth_user_created`.)
- **Type:** manual

---

## Blockers / operator actions needed

The following items cannot be fully automated or executed by the test author without external setup. Owner / operator must complete each before the matching test cases can run:

1. **Seeded test users (TC-PRED-09, TC-LB-07/08/09, TC-SCORE-*).**
   - Create at least 4 dedicated accounts: AdminX, PlayerB, PlayerC, PlayerD.
   - Email-deliverable inboxes (Mailosaur / Gmail aliases) so magic links can be received automatically.
   - Promote AdminX via `supabase/seed/admin.sql` (replace `OWNER_EMAIL@example.com`).
   - Document credentials in a secure shared place (1Password etc.) — do **not** commit.

2. **SMTP delivery (TC-AUTH-01, TC-AUTH-03).**
   - Default Supabase SMTP is rate-limited (≤3 emails/hour per address). For repeated runs, configure a custom SMTP provider in Supabase Auth settings.

3. **Test fixtures / safe sandbox (TC-SCORE-01..11, TC-LB-07..09).**
   - Use a **non-production Supabase project** mirror or carefully isolate test matches with kickoffs in 2099 so they never collide with real WC fixtures.
   - Ideally, branch the database (Supabase branching) for testing, then discard.

4. **Lighthouse + Web Vitals baseline (TC-PERF-04).**
   - Operator agrees the score thresholds (default suggestion: Perf ≥ 80, A11y ≥ 95) and treats this as a regression baseline once captured.

5. **Real mobile devices (TC-XB-03, TC-XB-04).**
   - Either a physical iOS + Android device or a BrowserStack subscription for Safari iOS / Chrome Android.

6. **Manual SQL access (many TC-* in Sections 5, 6, 7).**
   - Tester needs Supabase SQL Editor access (owner / "Maintainer" role) to seed predictions, mutate `predictions.submitted_at` for tie-breaker tests, and inspect `scores` / `v_leaderboard_overall`.

7. **Edit-display-name UI (TC-ONB-09).**
   - Spec requires a path for users to update their display name. No such UI exists today (search of `app/` returns no profile-edit page). Either (a) build the form before testing, or (b) confirm with product that this is a deferred ask and downgrade TC-ONB-09 to a known gap.

8. **Edit-kickoff UI (TC-ADMIN-07).**
   - The `/admin/matches` page has a "New fixture" form but no per-row edit-fixture form. Until added, the spec scenario "Admin edits kickoff time before kickoff" can only be exercised via SQL. Recommend adding an inline edit form to make this testable through the UI.

9. **Playwright harness (recommended).**
    - To convert the long manual checklist into automated regression coverage, set up Playwright with helpers for: magic-link sign-in via Supabase admin API, RLS write attempts via authenticated REST, leaderboard cache assertions. Out of scope for this plan but the highest-leverage follow-up.

---

**Total cases:** 66 across 10 functional sections + 3 operational regression checks.
