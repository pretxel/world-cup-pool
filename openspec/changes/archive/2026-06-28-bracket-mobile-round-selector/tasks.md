## 1. Share the card renderer

- [x] 1.1 In `components/bracket-view.tsx`, export `MatchCard` (and the `Labels` type) so both the desktop columns and the mobile selector render identical cards
- [x] 1.2 Confirm `MatchCard`/`ParticipantRow` stay plain render functions (no client boundary needed) so they import cleanly into a `"use client"` module

## 2. Mobile round selector component

- [x] 2.1 Create `components/bracket-rounds-mobile.tsx` (`"use client"`) taking `rounds` + `labels` (+ optional `className`)
- [x] 2.2 Hold active-round state with `useState`, defaulting to the first round in `rounds`
- [x] 2.3 Render a `TabsList` (from `@/components/ui/tabs`) of one `TabsTrigger` per round, using the localized round label (`labels.stage[stage]`, and `labels.thirdPlace` for the third-place round); allow the strip to scroll horizontally (`overflow-x-auto`, no wrap) so full labels are not truncated
- [x] 2.4 Render one `TabsContent` per round containing that round's `MatchCard`s stacked vertically full-width (e.g. `space-y-3`)
- [x] 2.5 Give the tablist an accessible label (localized); add a `bracket.roundSelectorLabel` key to `messages/{en,es,fr,de}.json` if a new string is needed (keep locale parity)

## 3. Wire responsive layout into BracketView

- [x] 3.1 Wrap the existing columnar layout (the `overflow-x-auto` columns + the third-place block) in `hidden lg:block` so it only shows on large screens
- [x] 3.2 Render `<BracketRoundsMobile rounds={rounds} labels={labels} className="lg:hidden" />` for small screens
- [x] 3.3 Keep `BracketView` server-rendered; only the new mobile child is a client island

## 4. Verification

- [~] DEFERRED (needs rendered bracket data; local has none) — 4.1 At 390px: round selector shows, one round's matches stack full-width, nothing clipped, no horizontal content scroll (only the tab strip may scroll); selecting each round swaps matches in place
- [~] DEFERRED (needs rendered bracket data; local has none) — 4.2 At ≥1024px (`lg`): the columnar layout is shown and visually unchanged from before
- [~] DEFERRED (needs rendered bracket data; local has none) — 4.3 Content parity: a round's cards (teams, scores, provisional/confirmed, kickoff/venue) match between the two layouts; live refresh still updates
- [~] DEFERRED (needs rendered bracket data; local has none) — 4.4 Keyboard: tab into the selector, arrow between rounds, visible focus; labels localized (spot-check es/fr/de)
- [x] 4.5 Run `pnpm typecheck` and `pnpm lint`
- [x] 4.6 Run `openspec validate bracket-mobile-round-selector --strict` and confirm it passes
