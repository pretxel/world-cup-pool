## Why

On phones the `/bracket` page renders the knockout bracket as fixed-width columns (`w-52`) inside a horizontally-scrolling `min-w-max` row. A live check at 390px shows the Round of 32 column filling the viewport, the "Round of 16" / "Quarter-final" headers clipped off the right edge, and later-round cards floating in large vertical gaps (from `justify-around` aligning them to feeders). The result forces two-axis scrolling and the bracket becomes unfollowable on mobile — the most common device for casual checking. Desktop (≥`lg`, ~1100px+) shows the columns acceptably and is out of scope here.

## What Changes

- Make `BracketView` **responsive**: keep the existing horizontal-column layout on **large screens** (`lg+`, unchanged) and render a **round-selector layout on small screens** (`< lg`).
- Mobile round selector: a horizontally-scrollable tab strip lists the rounds present (Round of 32 · Round of 16 · QF · SF · Final · Third place); selecting a round shows **that round's matches stacked vertically, full-width**, with no horizontal content scroll and nothing clipped.
- Reuse the existing `MatchCard`/`ParticipantRow` rendering for both layouts so card content, scores, provisional/confirmed treatment, kickoff/venue, and live-refresh stay identical.
- Keep the bracket **server-rendered**; only the small mobile round-selector chrome (active-round state) is a client island. Localized round labels and the graceful empty state are unchanged.
- **No change** to bracket resolution (slot projection, best-third allocation, match numbering), to the data the page fetches, or to the desktop layout.

## Capabilities

### New Capabilities
<!-- None. This refines the presentation of the existing /bracket surface governed by playoff-bracket. -->

### Modified Capabilities
- `playoff-bracket`: Add a requirement that the dedicated `/bracket` page presents the bracket responsively — a single-round selector on small screens (each round's matches stacked, no horizontal content scroll or clipping) and the columnar layout on large screens — without changing the resolved content or labels.

## Impact

- **Primary code:** `components/bracket-view.tsx` (split into large-screen columns `hidden lg:block` + a small-screen round-selector; export `MatchCard`/types for reuse), plus a small client component (e.g. `components/bracket-rounds-mobile.tsx`, `"use client"`) owning the active-round tab state.
- **Reused:** `components/ui/tabs.tsx` (Base UI tabs — same primitive used by the admin tabs), `MatchCard`, `LocalTime`, `TeamFlag`, `BracketLiveRefresh`, the localized `labels` already passed from the page.
- **i18n:** uses existing round labels (`labels.stage[...]`, `thirdPlace`); a short "view round" aria/label may be added to `messages/{en,es,fr,de}.json` for the selector.
- **Surfaces:** `/bracket` only. Public, no auth, no DB change. No breaking changes; desktop output is unchanged.
