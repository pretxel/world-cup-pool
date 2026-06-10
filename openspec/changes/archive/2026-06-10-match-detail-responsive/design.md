# Design: match-detail-responsive

## Context

The detail-page scoreboard (`app/[locale]/(public)/matches/[matchId]/page.tsx`) lays out home team / score / away team with `grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 ... sm:gap-6 sm:px-8`. Team names are `text-2xl` (sm: `text-4xl`) next to `lg` flags. At 320px the side columns get ~79px; after the flag and gap, the truncating name span has ~35px — one to two glyphs. Measured clipped at both 320px and 375px in en and es; no horizontal page overflow (the truncation hides it, which is why the earlier list-page audit didn't flag this page — it was out of scope).

This mirrors the problem already solved on the `/matches` list in `match-section-responsive` (archived 2026-06-10), which stacks teams below `sm`.

## Goals / Non-Goals

**Goals:**
- Full team names readable in the scoreboard at every width ≥ 320px.
- Scoreboard layout at `sm` (640px) and above pixel-unchanged.
- Verify the whole detail page at 320/375/414 (status chips, info strip, countdown, prediction section, sign-in card, group table); fix only confirmed issues.
- Tailwind-only, server markup, no new dependencies.

**Non-Goals:**
- No redesign of the prediction form's input controls.
- No changes to the `/matches` list (already done) or admin pages.

## Decisions

### 1. Stack scoreboard rows below `sm`, same pattern as the list change

Container becomes `flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6`. Home block, score/"vs" block, and away block each take the full width on mobile; names get ~270px instead of ~35px and effectively never truncate.

- *Alternative — shrink type/flags on mobile:* rejected; at 320px even `text-base` plus an `md` flag leaves long names ("Bosnia and Herzegovina") clipped in a 79px column. The column, not the font, is the constraint.
- *Alternative — wrap names to two lines:* rejected; multi-line names jitter the score row's vertical centering and read worse than a stacked scoreboard, which is the standard mobile pattern.

Away block keeps its right alignment on mobile (`text-right`, `justify-end` already present), preserving the home-left/away-right identity; the score/"vs" block centers itself (`place-items-center` works in both flex-column and grid contexts via `justify-items`/`align-items` equivalents — use `self-center` on mobile if needed).

### 2. Keep the truncate guards

The `min-w-0 truncate` on name spans stays as a safety net for pathological strings; on a full-width mobile row it should never trigger for real team names (longest is "Bosnia and Herzegovina", ~270px at `text-2xl` condensed — fits 320px content width minus flag).

### 3. Audit-then-fix for the rest of the page

Same method as the list change: headless-Chrome pass at 320/375/414 in en/es/fr checking `scrollWidth`, plus signed-out and (statically reviewed) signed-in/locked/final variants. Only confirmed clipping gets a fix. The prediction form and group table are flexbox/table components that sized fine at a glance; they get verified, not speculatively edited.

## Risks / Trade-offs

- [Stacked hero is taller on mobile] → Acceptable; it's the page's primary content and everything else moves down harmlessly.
- [Detail page has state variants hard to drive headlessly (signed-in, locked, final, cancelled, group sim)] → Static review of those branches' markup for fixed-width/overflow patterns; the risky construct (the 3-col grid) is shared by all variants, and the final-score variant replaces the center block only, so the stack fix covers every variant identically.
- [`place-items-center` on the center block behaves differently as flex child vs grid child] → Verify visually at both sides of 640px during the audit.

## Open Questions

None.
