## 1. Data plumbing

- [x] 1.1 In `lib/bracket.ts`, add `venue` to the `matches` `select(...)` column list.
- [x] 1.2 In `lib/bracket-core.ts`, add `venue: string | null` to `BracketMatchInput`.
- [x] 1.3 In `lib/bracket-core.ts`, add `venue: string | null` to `BracketSlotMatch` and populate it (`venue: fx.venue`) in `buildBracket`'s fixtures `.map(...)`.

## 2. View

- [x] 2.1 In `components/bracket-view.tsx`, import the `LocalTime` component.
- [x] 2.2 Add a compact footer line to `MatchCard` showing kickoff time via `<LocalTime iso={match.kickoffAt} ... />` and the venue text.
- [x] 2.3 Omit the venue (and any separator) when `match.venue` is null/empty; keep the kickoff time always visible.
- [x] 2.4 Style the footer to match the existing card idiom (small mono/uppercase like the provisional badge) and truncate long venue names so the fixed-width column doesn't widen.

## 3. Verify

- [x] 3.1 Update/extend `bracket-core` unit tests to cover `venue` passthrough (present and null) in `BracketSlotMatch`.
- [x] 3.2 Run `pnpm lint` and `pnpm test` (or the project's equivalents) and confirm they pass. (typecheck + lint clean; 997/997 tests pass.)
- [ ] 3.3 Manually verify `/bracket`: cards show kickoff time (localized after hydration) and stadium; cards with no venue render cleanly; no console hydration warnings; mobile columns still scroll without overflow. (SSR returns 200; local dev competition has no knockout fixtures, so the card footer needs an env with knockout data to exercise live.)
