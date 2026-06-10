# Proposal: match-detail-responsive

## Why

The match detail page (`/matches/[matchId]`) scoreboard renders team names unreadably on small phones: the hero uses a fixed three-column grid (`grid-cols-[1fr_auto_1fr]`) at all widths, leaving ~79px per team side at 320px, so "Mexico" truncates to "M…" and "South Africa" to "S…" (measured: 35px visible of 83/144px needed; still clipped at 375px). The prior `match-section-responsive` change fixed the `/matches` list but explicitly excluded the detail page. Reported by the user from a 320px device.

## What Changes

- Restructure the scoreboard hero so teams stack vertically below the `sm` breakpoint (640px) — full-width home row, centered score/“vs” block, full-width away row — and keep the existing three-column grid unchanged at `sm` and above.
- Verify the rest of the detail page (status chips, kickoff/venue strip, countdown, prediction section, sign-in card, group standings table) at 320–414px and fix any clipping or overflow found.
- No data, routing, or prediction logic changes — purely presentational.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `match-presentation`: add a requirement that the match detail scoreboard renders team names legibly at all viewport widths ≥ 320px, stacking teams below `sm` while preserving the desktop layout.

## Impact

- `app/[locale]/(public)/matches/[matchId]/page.tsx` — scoreboard hero grid markup.
- Possibly `app/[locale]/(public)/matches/[matchId]/prediction-form.tsx` and `components/group-standings-table.tsx` if the 320px audit finds issues (verify-only otherwise).
- No API, database, or dependency changes.
