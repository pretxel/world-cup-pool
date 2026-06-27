## Why

The public `/bracket` cards show only the two participants and (once final) the score. Visitors planning which matches to watch — or where — have to leave the bracket and open each fixture to learn when and where it kicks off. Surfacing the kickoff time and stadium directly on each bracket card removes that round-trip and makes the bracket a self-contained schedule of the knockout stage.

## What Changes

- Each knockout bracket card (Round of 32 → Final, plus the third-place play-off) gains a footer showing the match **kickoff time** and **stadium (venue)**.
- The kickoff time renders in the visitor's local timezone/locale (the same client-localized `<LocalTime>` treatment used on the matches pages), with a deterministic UTC server fallback to avoid hydration mismatch.
- The venue renders when known; when a fixture has no recorded venue, the card omits the venue line gracefully (no empty separator or "null").
- The bracket data loader and the pure bracket model carry the `venue` field through to the view (`kickoff_at` is already carried).
- No change to slot resolution, match numbering, provisional/confirmed logic, or live-refresh behavior.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `playoff-bracket`: add a requirement that each bracket card displays the fixture's kickoff time (locale/timezone-aware) and stadium, degrading gracefully when the venue is unknown.

## Impact

- **Code**
  - `lib/bracket.ts` — add `venue` to the `matches` select.
  - `lib/bracket-core.ts` — add `venue: string | null` to `BracketMatchInput` and `BracketSlotMatch`; populate it in `buildBracket`.
  - `components/bracket-view.tsx` — render a kickoff-time + venue footer in `MatchCard` (kickoff via the client `LocalTime` component).
- **Data**: reads the existing `public.matches.venue` column; no schema change.
- **i18n**: optional small label key(s) in the `bracket` namespace per locale (en, es, fr, de) if a labelled presentation is chosen; no behavioral i18n change.
- **No impact** on APIs, auth, scoring, or the live-refresh pipeline.
