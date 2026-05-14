## Why

The current match-facing UI is functional but visually flat: team names are plain text, stages are differentiated only by a small uppercase label, and the match detail "scoreboard" relies entirely on typography. For a tournament product where users emotionally engage with countries and stadiums, this leaves a lot of identity on the table. Users have asked for richer cues — flags, venue imagery, and motion on the detail page — to make picking feel like part of the spectacle.

## What Changes

- New `TeamFlag` component renders an SVG flag for known WC2026 country teams. Falls back to a neutral chip for knockout placeholder slots like `2nd Group A` or `Winner R32-1`.
- Vendored SVG flags for the 48 participating nations under `public/flags/<iso>.svg` (sourced from the MIT-licensed `lipis/flag-icons` repo). No new npm dependency.
- Flags integrated into:
  - `/matches` list rows (small flags next to team names).
  - `/matches/[matchId]` scoreboard (large flags flanking team names in the hero panel).
  - `/my-picks` rows (small flags next to team names).
- New `StageIcon` component renders a per-stage inline SVG (group dots, knockout brackets, third-place medal, final trophy). Appears next to the stage chip on the detail page.
- New `VenueImage` component renders an optional venue photo from `public/venues/<slug>.jpg` as a subtle backdrop in the match detail scoreboard. Falls back to the existing pitch-stripe + grain treatment when no image is shipped — venue photo files are optional and can be added incrementally.
- Tailwind-driven animations on `/matches/[matchId]`: scoreboard fades + slides in on mount; live status badge pulses; final score numerals flip in when revealed. List rows on `/matches` get a subtle stagger-in. All animations use the already-installed `tw-animate-css` utilities — no new JS dep.

## Capabilities

### New Capabilities
- `match-presentation`: visual rendering rules for matches across list, detail, and picks views — flags, stage icons, venue imagery, and entry animations.

### Modified Capabilities
<!-- none -->

## Impact

- Code: `components/team-flag.tsx`, `components/stage-icon.tsx`, `components/venue-image.tsx` (new); `lib/team-flag.ts` (team→ISO map); `app/(public)/matches/page.tsx`, `app/(public)/matches/[matchId]/page.tsx`, `app/(app)/my-picks/page.tsx` (consumers).
- Assets: `public/flags/*.svg` (48 SVGs, ~50KB total); optionally `public/venues/*.jpg` (deferred / additive).
- Tests: `tests/team-flag.test.ts` for the ISO mapping (covers all 48 teams + the placeholder pattern).
- No DB changes. No new runtime deps. No public API changes.
- Bundle: vendored SVGs served as static assets — no JS bundle growth. CSS animations via existing `tw-animate-css`.
