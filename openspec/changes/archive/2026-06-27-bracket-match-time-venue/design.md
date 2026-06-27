## Context

The `/bracket` page renders a data-driven knockout bracket. The server loader (`lib/bracket.ts`) reads `public.matches` and feeds rows to the pure resolver (`lib/bracket-core.ts → buildBracket`), which produces `BracketRound[] / BracketSlotMatch[]`. `components/bracket-view.tsx` renders each `BracketSlotMatch` as a `MatchCard` (two participant rows + optional score + optional provisional badge).

`BracketSlotMatch` already carries `kickoffAt` (it's used for stable ordering), but the card does not display it. The `venue` column exists on `public.matches` (`string | null`) and is already shown on the matches detail page, but it is not selected by the bracket loader nor carried through the bracket model.

The rest of the app renders kickoff times with the client `<LocalTime>` component (`components/local-time.tsx`): the server emits a deterministic UTC fallback, then the component reformats to the visitor's locale/timezone after mount (`suppressHydrationWarning`). Venue is rendered as a plain string.

Constraints: the server stays the single source of truth (the live-refresh requirement forbids the client re-deriving the bracket); the bracket model is pure and unit-tested; the page is locale-aware (en, es, fr, de).

## Goals / Non-Goals

**Goals:**
- Show each bracket card's kickoff time (locale/timezone-aware) and stadium.
- Reuse existing patterns (`<LocalTime>`, the existing venue string) for consistency.
- Degrade gracefully when a fixture has no venue.
- Keep the change confined to the loader, the model field, and the view — no behavioral change to resolution/numbering/live-refresh.

**Non-Goals:**
- No schema change; no new venue metadata, images, or geocoding.
- No change to slot resolution, provisional/confirmed status, FIFA numbering, or the realtime refresh pipeline.
- No redesign of the bracket layout beyond adding a compact footer line.

## Decisions

### Decision: Carry `venue` through the existing model, mirroring `kickoff_at`
Add `venue: string | null` to `BracketMatchInput` (in `bracket-core.ts`, alongside the `GroupTableMatch`-derived fields) and to `BracketSlotMatch`; populate it in `buildBracket`'s `matches.map(...)`. Add `venue` to the `select(...)` in `lib/bracket.ts`.

*Alternative considered:* a second query / join keyed by match id in the view. Rejected — the loader already returns the rows; threading one extra column is simpler and keeps the resolver the single shaping point.

### Decision: Render kickoff time with the client `<LocalTime>` component
The card footer uses `<LocalTime iso={match.kickoffAt} format="datetime" />` (or a compact `time`/`date` variant), matching the matches pages. This gives each visitor their local timezone without a hydration mismatch (server renders UTC fallback, client swaps after mount).

*Alternative considered:* server-format the time in a fixed timezone. Rejected — inconsistent with the rest of the app and confusing for a global audience whose kickoff-relevant timezone is their own.

### Decision: Venue is optional; omit the line when absent
When `match.venue` is null/empty, render no venue text and no dangling separator. The kickoff time always renders (`kickoff_at` is non-null in the schema).

*Alternative considered:* a "Venue TBD" placeholder. Deferred to an open question — for knockout fixtures the venue is usually known, and a placeholder adds an i18n key; default is to omit, but a labelled "TBD" is acceptable if preferred.

### Decision: Keep i18n minimal
Time and venue are self-describing in context, so no labels are strictly required. If a labelled presentation (e.g. an icon + "Venue") is chosen, add the key(s) to the `bracket` namespace across all four locales. Default: no new keys.

## Risks / Trade-offs

- **Card height grows, tightening the horizontally-scrolling columns on mobile** → keep the footer to a single compact line (small mono/uppercase, like the existing provisional badge); wrap venue with truncation so a long stadium name can't widen the fixed-width column.
- **`<LocalTime>` adds a client component inside an otherwise server-rendered card** → it's already used widely; the cost is negligible and the UTC fallback keeps SSR deterministic and hydration-safe.
- **Some fixtures may carry an inconsistent venue string** → render verbatim (as the matches pages do); normalization is out of scope.

## Migration Plan

Pure additive UI/display change. Deploy normally; no migration, no backfill. Rollback = revert the diff. The venue column and `kickoff_at` already exist, so older data renders correctly (venue simply omitted where null).

## Open Questions

- Show a "Venue TBD" placeholder when venue is null, or omit silently? (Default: omit.)
- Labelled presentation (icon/label) vs. bare time + venue text? (Default: bare, no new i18n keys.)
