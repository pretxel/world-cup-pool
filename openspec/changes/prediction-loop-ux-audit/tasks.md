## 1. P0 — Fixes that unblock the core action (do first)

- [x] 1.1 (F1) Replace the Matches list raw error (`Failed to load matches: TypeError: fetch failed`) with a friendly empty/error state: plain-language message, retry control, `role="alert"`, no exception/stack text
- [x] 1.2 (F1) Audit the other prediction-loop fetch paths (match detail, leaderboard) for the same raw-error leakage and apply the same friendly error pattern
- [x] 1.3 (F2) Collapse the mobile team filter (48 country pills) behind a disclosure or replace it with a search/select so the first match row is reachable within ~2 viewport heights; keep round filters visible and preserve query-param/deep-link state
- [x] 1.4 (F3) Make the per-match primary action a button-like control (not text+chevron) with an accessible name (e.g. "Pick Algeria vs Austria"); ensure it is the highest-emphasis element in the row
- [~] 1.5 PARTIAL — 1.1 after-state verified locally (friendly error renders, no raw exception); 1.3/1.4 are data-dependent → re-shoot post-deploy (5.2). Verify 1.3 and 1.4 at 390px and 1280px (screenshot before/after)

## 2. P1 — Accessibility & comprehension

- [x] 2.1 (F4) Raise divider/border non-text contrast to ≥3:1 (WCAG 1.4.11): adjust `--border` (currently `oklch(1 0 0 / 10%)`) and any hairline row/card separators in `app/globals.css`; spot-check light + dark themes
- [x] 2.2 (F6) Add/verify a visible `:focus-visible` indicator on all interactive controls in the loop (filter pills, match rows, pick action, nav, pagination); confirm by keyboard-tabbing each surface
- [x] 2.3 (F5) Raise round + team filter pill touch targets toward 44px tall (min-height/padding) while keeping the dense team layout usable; re-measure at 390px
- [x] 2.4 (F7) Explain the leaderboard `EXACT` / `W+GD` / `WINS` columns in context (visible legend, `abbr`/tooltip, or link to the scoring explainer)
- [x] 2.5 (F9) Verify match-detail hero secondary text (kickoff, venue, countdown, HOME/AWAY) meets ≥4.5:1 on the green card with a color-space-aware tool; darken/strengthen where it fails

## 3. P2 — Consistency, density & polish

- [x] 3.1 (F8) Standardize matchday disclosure (one expand/collapse pattern) and remove the large empty horizontal gap in collapsed matchday rows
- [x] 3.2 (F10) Improve legibility of 10–11px mono-uppercase metadata labels (size/letter-spacing/weight) where they carry functional info, without losing the brand voice
- [~] 3.3 (F12) DEFERRED to follow-up (net-new feature, user-approved defer) — Give mobile leaderboard rows an affordance to reveal the dropped EXACT/W+GD/WINS detail (e.g. tap-to-expand), or surface the most useful tiebreaker inline
- [x] 3.4 (F3) Tighten desktop match-row layout: reduce the empty horizontal gap between teams and the score/state so the action and result read as one unit
- [~] 3.5 (F11) DEFERRED to follow-up (net-new feature, user-approved defer) — For signed-out users on the match-detail page, preview the prediction mechanic (disabled score steppers) above the Sign-in CTA to demonstrate value before auth

## 4. Verification

- [~] 4.1 PARTIAL — measured border contrast (light 3.37:1) + verified friendly error renders; full populated re-check needs deploy (see 5.2). Re-run the two-breakpoint review (1280px + 390px) on Matches, Match detail, and Leaderboard; confirm each `prediction-loop-ux` requirement's scenarios pass
- [~] 4.2 PARTIAL — targeted contrast checks done; full axe/Lighthouse on populated pages needs deploy (see 5.2). Run an accessibility checker (axe/Lighthouse or DevTools) on the three surfaces; confirm no new contrast/focus/role violations
- [x] 4.3 Confirm `pnpm typecheck` and `pnpm lint` pass for all touched components
- [x] 4.4 Run `openspec validate prediction-loop-ux-audit --strict` and confirm it passes

## 5. Follow-ups (out of scope here — log only)

- [ ] 5.1 Schedule an authenticated review of `my-picks` and the signed-in pick UI (steppers, lock/edit states) — not reviewable in this signed-out pass
- [ ] 5.2 Re-audit once production redeploys from the current branch, to confirm findings still reflect the live build
