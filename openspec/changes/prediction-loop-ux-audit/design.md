## Context

This change is the output of a **live visual UX/UI review**, not a feature build. The review ran against the production deployment (`world-pool.edselserrano.com`) because the local dev environment cannot reach Supabase (`TypeError: fetch failed`), so data-driven surfaces don't render locally. Production was driven in headless Chrome at **1280×900 (desktop)** and **390×844 (mobile)**, with full-page screenshots plus computed-style/token inspection.

Scope (per the requester): the **core prediction loop** — Matches list, Match detail (pick flow), Leaderboard/Standings. Out of scope: admin, quiz, groups, news, share. `my-picks` is auth-gated and was not reviewed live.

The four ranked lenses: **Accessibility (WCAG) · Mobile UX · Visual consistency · Conversion & engagement.**

## Goals / Non-Goals

**Goals:**
- Turn the live findings into an objective, testable quality bar (`specs/`) and a prioritized remediation checklist (`tasks.md`).
- Ground every requirement in a reproducible observation, with the design tokens / measurements that justify it.

**Non-Goals:**
- No new product feature, no new dependency.
- Not a full a11y certification — contrast/keyboard claims flagged "verify" are remediation tasks, not asserted failures, where automated measurement was unreliable for the app's `oklch`/`lab` color space.
- No live review of authenticated surfaces (`my-picks`, signed-in pick UI) — listed as a follow-up.

## Decisions

### D1: Audit production, not local
Local dev fails to load match data (`fetch failed`), so a meaningful visual review of populated screens requires production. Trade-off: production may lag the working branch; findings are timestamped to the review and re-verifiable.

### D2: Express findings as measurable acceptance criteria
Each finding maps to a SHALL with an objective threshold (e.g. non-text contrast ≥3:1, touch target ≥44px, primary action is a button-role control, no raw exception text in UI). This makes remediation verifiable and regression-checkable rather than subjective.

### D3: Prioritize P0/P1/P2 by impact on the primary job
P0 = blocks or visibly degrades the core action / leaks errors / buries content. P1 = clear friction or a11y gap. P2 = polish/consistency. The checklist is ordered so the highest-leverage fixes ship first.

### D4: Token-level fixes over per-component patches where possible
Several issues trace to `app/globals.css` tokens (e.g. `--border: oklch(1 0 0 / 10%)`, muted label sizing). Fixing the token raises the floor everywhere, so prefer that over one-off component overrides.

## Findings (live review)

Severity drives priority; "Lens" is the primary dimension.

| # | Lens | Finding (observed) | Evidence | Sev |
|---|------|--------------------|----------|-----|
| F1 | Conversion | Matches list error state leaks `Failed to load matches: TypeError: fetch failed` to the user | Local prod-data failure rendered raw exception text | P0 |
| F2 | Mobile | Team filter = 48 country pills expanded by default; the match list sits ~3 screens down; page is 6360px tall at 390px | Mobile screenshot + `scrollHeight=6360` | P0 |
| F3 | Conversion | Per-match primary action ("Pick") is low-emphasis text + chevron, not a button-like affordance | Matches list desktop/mobile | P0 |
| F4 | Accessibility | Dividers/borders use `--border: oklch(1 0 0 / 10%)` (10% white) → UI-boundary contrast almost certainly <3:1 (WCAG 1.4.11); rows/cards hard to separate on dark bg | `app/globals.css:119`; visual | P1 |
| F5 | Mobile | Round + team filter pills measure ~26px tall (passes WCAG 2.5.8 AA 24px min; below the comfortable/AAA 44px), in a dense flag wall → mis-tap risk | Computed `getBoundingClientRect().height ≈ 26` | P1 |
| F6 | Accessibility | Visible keyboard focus states on filter pills, match rows, and nav are unverified | Not confirmable from screenshots | P1 |
| F7 | Visual | Cryptic leaderboard columns `EXACT` / `W+GD` / `WINS` with no inline legend/tooltip | Leaderboard desktop | P1 |
| F8 | Visual | Matchday disclosure is inconsistent (past matchdays collapsed, others expanded) and collapsed rows carry large empty horizontal whitespace | Matches list desktop | P2 |
| F9 | Accessibility | Faint secondary text on the green match-detail hero ("TO KICKOFF", HOME/AWAY, kickoff/venue: dark-green on medium-green) — verify ≥4.5:1 | Match detail mobile | P2 |
| F10 | Accessibility | 10–11px mono-uppercase metadata labels with wide letter-spacing reduce legibility even where contrast passes | Eyebrows, card metadata | P2 |
| F11 | Conversion | Signed-out pick page shows only a sign-in prompt; no disabled preview of the score-prediction mechanic to demonstrate value pre-auth | Match detail mobile (signed out) | P2 |
| F12 | Mobile | Leaderboard drops EXACT/W+GD/WINS entirely on mobile; tiebreaker detail becomes unreachable (no expand affordance) | Leaderboard mobile | P2 |

**Positives to preserve:** `@media (prefers-reduced-motion: reduce)` is handled (`globals.css:247`); body text contrast is strong (`--foreground` on `--background` ≈ 15:1); leaderboard rank badges (gold/silver/green) and the responsive column-drop are well executed; nav correctly collapses to a hamburger on mobile.

## Risks / Trade-offs

- **[Production drift]** Findings reflect the deployed build at review time → Mitigation: each task is re-verifiable at its breakpoint; re-run the two-breakpoint check after fixes.
- **[`oklch`/`lab` contrast measurement]** Scripted WCAG ratios were unreliable for the app's modern color space → Mitigation: contrast tasks require verification with a color-space-aware tool (or DevTools), and reason from token L-values, not ad-hoc RGB math.
- **[Token changes ripple]** Raising `--border` opacity affects every surface → Mitigation: spot-check light + dark themes across surfaces after the token change.
- **[Collapsing the team filter]** A disclosure/search changes a discovery affordance → Mitigation: keep round filters visible; gate only the long team list; preserve deep-link/query-param state.

## Migration Plan

Not a deploy/migration change. Remediation tasks ship as ordinary component/token PRs, each verified at 1280px and 390px against the criteria in `specs/`.

## Open Questions

- Should `my-picks` and the signed-in pick UI get a follow-up authenticated review? (Recommended — out of scope here.)
- Is a disclosure or an inline search the better pattern for the team filter on mobile? (Resolve during F2 implementation.)
