# Design: match-section-responsive

## Context

The `/matches` page (`app/[locale]/(public)/matches/page.tsx`) renders day-grouped match rows via the local `MatchRowCard` component. Each row is a single horizontal flex line: a fixed `w-14` kickoff column, a vertical divider, a stage/badge chip row plus a one-line `home — vs — away` team line (both names `truncate`), an optional venue line, and a right-aligned score/status column with a chevron. Above the list sit the status stat-card filter (3-column grid), the needs-pick toggle, and the wrapping team-chip filter. Day headers are sticky at `top-[3.55rem]`.

The layout was tuned at desktop widths. At 320–400px the single team line forces both names to truncate (long names like "United States" + "Saudi Arabia" become unreadable), and the kickoff column + divider + status column consume ~40% of the row width. All styling is Tailwind CSS v4 utilities; there is no e2e/browser test infrastructure in the repo.

## Goals / Non-Goals

**Goals:**
- Matches section legible and usable at every viewport ≥ 320px wide with zero horizontal page overflow.
- Team names readable on small phones — no double-truncation of a single packed line.
- Preserve the existing desktop appearance at `sm:` (640px) and up.
- Tailwind-only changes; server-rendered markup, no new client JS, no new dependencies.

**Non-Goals:**
- No changes to filtering, querying, locking, or pick logic.
- No redesign of the match detail page (`/matches/[matchId]`) or admin matches table — separate change if an audit finds issues there.
- No e2e test framework introduction (Playwright etc.).

## Decisions

### 1. Stack teams vertically below `sm`, keep current inline row at `sm:`+

On viewports < 640px, `MatchRowCard` renders the two teams as two stacked lines (flag + full name each), the standard mobile scoreboard pattern. At `sm:` and up the existing single-line `home vs away` layout is preserved unchanged.

- *Alternative — shrink fonts/flags on mobile:* rejected; still truncates long names at 320px and hurts legibility.
- *Alternative — separate mobile component:* rejected; responsive utility classes on one markup tree avoid divergence and hydration cost.

Mechanism: the team block becomes `flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2`; the "vs" separator is hidden below `sm` (`hidden sm:inline`); names keep `truncate` as a guard but should rarely need it on their own line.

### 2. Compress the leading kickoff column on mobile instead of dropping it

Keep the kickoff time visible at all widths (it is primary information), but below `sm` drop the "Kickoff" eyebrow label and the decorative vertical divider (`hidden sm:block`), and let the column shrink (`w-auto sm:w-14`). This recovers ~30px of row width on phones without losing data.

- *Alternative — move time into the badge row:* rejected; changes information hierarchy at all sizes and complicates the markup more than hiding two decorative elements.

### 3. `min-w-0` + `break-words`/`truncate` discipline for overflow safety

Every flex child that can carry long text (team names, venue) gets `min-w-0` on its flex container and `truncate` (single-line) or `break-words` where wrapping is acceptable. This is the structural guarantee behind the "no horizontal overflow at 320px" requirement — overflow comes from flex items refusing to shrink, not from any one string.

### 4. Verification is a manual breakpoint audit, recorded in tasks

No browser test infra exists and adding one is out of scope (Non-Goals). Validation is a documented manual audit at 320 / 375 / 414 / 768 / 1024 / 1280px using devtools device emulation, checking: `document.documentElement.scrollWidth <= window.innerWidth`, sticky header offset under the nav, stat-card label clipping, and chip wrap. The spec scenarios are written observably so they can be automated later if e2e tooling arrives.

### 5. Filters: verify, only touch if audit fails

`MatchTeamFilter` already uses `flex-wrap`, and `MatchStatusFilter`'s 3-column grid fits 320px (~96px per card). These are expected to pass; the audit confirms, and only confirmed clipping (e.g. long localized stat labels in `es`/`fr`) triggers a fix (e.g. `truncate` on the `dt`, tighter mobile padding). Avoids speculative churn.

## Risks / Trade-offs

- [Stacked mobile rows are taller → more scrolling on busy matchdays] → Acceptable: legibility beats density on phones; day grouping and filters already limit visible rows.
- [`sm:` breakpoint splits layout testing surface in two] → Audit checklist covers both sides of the 640px boundary (414px and 768px included).
- [Sticky header offset `top-[3.55rem]` assumes a fixed nav height across breakpoints] → Audit measures the real nav height at mobile and desktop; if they differ, use responsive offsets (`top-[<mobile>] sm:top-[<desktop>]`).
- [Localized strings (es/fr) longer than English may clip where English fits] → Audit runs in the longest-string locale for the stat cards and row labels, not just English.

## Audit findings (recorded during apply)

Headless-Chrome audit at 320/375/414/768/1024/1280 in en/es/fr found:

1. **Nav overflow at 320 in es/fr (not the matches list).** The signed-out sign-in link passed `className: "hidden sm:inline-flex"` through `buttonVariants()` raw — cva appends without tailwind-merge, so the base `inline-flex` won the CSS-order conflict against `hidden` and the button rendered at all widths. Long labels ("Se connecter", "Iniciar sesión") pushed the nav 3–5px past 320. Fixed in `site-nav.tsx` with `cn(buttonVariants({size:"sm"}), "hidden sm:inline-flex")`.
2. **Stat-card label clip at 768 pre-existed on main** (en "UPCOMING": 64px text in a 61px `dt`). The header flex squeezed the `dl` because `grid-cols-3` tracks are `minmax(0,1fr)`. Fixed with `sm:shrink-0` on the `dl` — at 1280 the `dl` already sat at max-content width, so desktop is pixel-unchanged; at 768 it grows 9px and the clip disappears. `truncate` on the `dt` retained as a guard for future longer strings.
3. **Nav height is 53px below `md` and 57px at `md`+** (NavLinks h-8 appear at `md`; smaller controls below). The single sticky offset `top-[3.55rem]` left a 3.8px see-through gap on phones. Fixed with `top-[3.3rem] md:top-[3.55rem]` (0.2px overlap on both sides of the boundary; `md`, not `sm`, because the height changes when NavLinks appear).
4. Mobile right-column status text (es "PRONOSTICAR" ≈ 88px) was the remaining width hog at 320; hidden below `sm` since `MatchStateBadge` in the chip row already shows the same state. Final scores stay visible at all widths.

Verification: 18/18 locale×width combos with zero horizontal overflow; teams stack below 640px and render single-line at 640px+; desktop screenshots diff vs `main` at 0.005–0.012% (sub-pixel text antialias on the sign-in button only); lint, typecheck, and 131/131 tests pass.

## Open Questions

None — scope is presentational and self-contained.
