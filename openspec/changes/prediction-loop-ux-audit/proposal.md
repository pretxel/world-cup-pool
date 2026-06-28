## Why

A live visual UX/UI review of the production app (`world-pool.edselserrano.com`) across the **core prediction loop** — Matches list, Match detail (pick flow), and Leaderboard/Standings — at desktop (1280px) and mobile (390px) surfaced concrete, reproducible gaps in **accessibility, mobile usability, visual consistency, and conversion**. The product's visual language is strong, but several issues directly blunt the primary job (make a prediction) and the first-impression for signed-out visitors: the actual match list is buried below a 48-team filter wall on mobile, the per-match call-to-action reads as plain text rather than an action, and a raw `TypeError: fetch failed` can leak to users. This change captures those findings as a verifiable quality bar plus a prioritized remediation checklist so the fixes can be implemented and regression-checked.

## What Changes

- Establish a **prediction-loop UX/UI quality bar** — measurable acceptance criteria across four lenses (accessibility/WCAG, mobile UX, visual consistency, conversion) that the Matches, Match-detail, and Leaderboard surfaces SHALL meet.
- Produce a **prioritized remediation checklist** (P0/P1/P2) in `tasks.md`, each item traceable to a finding from the live review.
- Key remediations the criteria drive:
  - **Mobile:** collapse the team-filter wall behind a disclosure/search so the match list is reachable without multi-screen scroll; raise filter touch targets toward the comfortable 44px.
  - **Conversion:** give the per-match primary action ("Pick") a clear button-like affordance; replace raw error leakage with a friendly empty/error state + retry; preview the prediction mechanic for signed-out users.
  - **Accessibility:** raise divider/border non-text contrast to ≥3:1 (WCAG 1.4.11), confirm visible keyboard focus states on all interactive controls, and verify small mono-label legibility/contrast.
  - **Consistency:** standardize matchday disclosure behavior and clarify the cryptic `EXACT` / `W+GD` / `WINS` leaderboard columns.
- This is an **audit + remediation** initiative; it adds no new product feature and no new dependency. It is intentionally scoped to the core prediction loop (admin, quiz, groups, news, share excluded).

## Capabilities

### New Capabilities
- `prediction-loop-ux`: The UX/UI quality criteria the core prediction-loop surfaces (Matches list, Match detail, Leaderboard/Standings) must satisfy across accessibility, mobile usability, visual consistency, and conversion — expressed as testable requirements with scenarios so each remediation task has an objective pass/fail.

### Modified Capabilities
<!-- None at the requirement level. This change codifies cross-cutting UX/UI acceptance
     criteria for existing surfaces; it does not alter the behavioral requirements of
     match-presentation, leaderboard, or predictions-lock. Implementation tasks may touch
     those components, but their functional specs are unchanged. -->

## Impact

- **Surfaces audited:** `/[locale]/(public)/matches`, `/[locale]/(public)/matches/[matchId]`, `/[locale]/(public)/leaderboard` (+ `/standings`). `my-picks` is auth-gated and was not reviewed live (flagged as a follow-up).
- **Likely components touched by remediation:** `components/match-day-section.tsx`, `match-team-filter.tsx`, `match-round-filter.tsx`, `match-state-badge.tsx`, the matches list/error boundary, `leaderboard-table.tsx`, `scoring-explainer.tsx`, and `app/globals.css` design tokens (`--border` opacity, muted label sizing).
- **Method:** live visual review via headless Chrome at two breakpoints with computed-style/token inspection; no code changed in this change — artifacts only.
- **No breaking changes.**
