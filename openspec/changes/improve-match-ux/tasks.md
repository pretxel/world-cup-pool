## 1. Flag assets + mapping

- [x] 1.1 Create `public/flags/` and vendor 48 SVG flags from the MIT-licensed `lipis/flag-icons` repo (filenames: `<iso>.svg`, including `gb-eng.svg` and `gb-sct.svg`).
- [x] 1.2 Add `public/flags/README.md` with attribution + license text.
- [x] 1.3 Create `lib/team-flag.ts` exporting `TEAM_FLAG: Record<string, string>` (every WC2026 country team in the seed) and a helper `flagSlug(team: string): string | null`.

## 2. Components

- [x] 2.1 Create `components/team-flag.tsx` — server component, renders `<img>` from `/flags/<slug>.svg` with `sm`/`md`/`lg` sizes and `alt="<team> flag"`. Renders a neutral placeholder chip when `flagSlug` returns `null`. No layout shift across known/unknown teams.
- [x] 2.2 Create `components/stage-icon.tsx` — server component, switch over `MatchStage` returning a distinct inline SVG per stage. Includes `aria-hidden="true"`.
- [x] 2.3 Create `lib/venues.ts` exporting `VENUE_PHOTOS: Set<string>` (empty by default) and a helper `venueSlug(venue: string): string` (kebab-case of the stadium name portion before the comma).
- [x] 2.4 Create `components/venue-image.tsx` — server component, renders `next/image` from `/venues/<slug>.jpg` when the slug is present in `VENUE_PHOTOS`, else returns `null`.

## 3. Wire flags into existing pages

- [x] 3.1 `app/(public)/matches/page.tsx`: add small `TeamFlag` next to each `home_team` and `away_team` in the row layout. Keep existing typography.
- [x] 3.2 `app/(public)/matches/[matchId]/page.tsx`: add large `TeamFlag` flanking team names in the scoreboard's home/away columns. Add `StageIcon` next to the stage chip. Add `VenueImage` as an optional backdrop (when the manifest has the slug).
- [x] 3.3 `app/(app)/my-picks/page.tsx`: add small `TeamFlag` next to each team name in pick rows.

## 4. Animations

- [x] 4.1 Add hero scoreboard mount animation to `app/(public)/matches/[matchId]/page.tsx` via `tw-animate-css` utilities (fade + slide-up). Use `motion-safe:` prefix where the utility doesn't already gate itself.
- [x] 4.2 Add stage chip + (when `isFinal`) score-numeral entrance animations on the same page.
- [x] 4.3 Add `animate-pulse` (motion-safe) wrapper on the live status badge for `status === 'live'`.
- [x] 4.4 Add staggered fade+slide entrance on `/matches` rows via inline `style={{ animationDelay }}`. Cap delay at 800ms.

## 5. Tests

- [x] 5.1 Add `tests/team-flag.test.ts`:
  - `flagSlug` returns expected ISO for every key in `TEAM_FLAG`.
  - `flagSlug` returns `null` for `"2nd Group A"`, `"3rd Group A/B/C/D/F"`, `"Winner R32-1"`, `"Atlantis"`.
  - Mapping completeness: read `supabase/seed/matches.sql`, extract distinct team strings, filter to country-shaped strings (not matching the placeholder regex), assert every one has a non-null `flagSlug`.
- [x] 5.2 Run `pnpm test` — all green.

## 6. Verification

- [x] 6.1 `pnpm typecheck` — zero errors.
- [x] 6.2 `pnpm lint` — zero errors.
- [x] 6.3 `openspec validate improve-match-ux` — valid.
- [ ] 6.4 `pnpm dev` and visually verify: `/matches` shows flags + staggers in; `/matches/<id>` for a group-stage match shows flags + stage icon + animated entrance; `/my-picks` shows flags; placeholder rendering on a knockout-placeholder team is clean.
- [ ] 6.5 In Chrome DevTools, enable "Emulate CSS prefers-reduced-motion: reduce" and confirm entrance animations are suppressed.
