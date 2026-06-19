## Why

The knockout fixtures already exist in the DB, but every participant is a placeholder ("Winner Group C", "2nd Group F", "3rd Group A/B/C/D/F", "Winner Match 73"), so the public sees nothing until an admin manually renames each one. Now that real group standings are computed from synced results, we can project the bracket automatically — showing fans, live and provisionally, who is on course to meet whom as the group stage unfolds.

## What Changes

- Add a dedicated, public `/bracket` page rendering the full knockout bracket (Round of 32 → Final, plus the third-place play-off) for the active competition, with a primary-nav link.
- Add a **slot resolver** that fills knockout participants from live data:
  - `Winner Group X` / `2nd Group X` → that group's current rank-1 / rank-2 team from the real standings (reusing `buildGroupTables`). Shown **provisionally** while the group is still in progress, **confirmed** once the group has played all its matches.
  - `3rd Group X/Y/Z/…` → resolved via the official FIFA 2026 **best-third allocation table** once all 12 groups are complete; until then the slot shows its candidate groups.
  - `Winner Match NN` / `Loser Match NN` (R16 → Final) → resolved from the referenced knockout fixture's actual recorded result; otherwise the slot stays a placeholder (these depend on knockout outcomes, not group standings).
- Add a deterministic **match-number map** (FIFA numbering: group 1–72, R32 73–88, R16 89–96, QF 97–100, SF 101–102, third 103, final 104) derived from `(stage order, kickoff, id)`, so `Winner Match NN` references resolve to fixtures.
- Add a data-driven **bracket view** component (responsive, horizontally scrollable on mobile) reusing `TeamFlag` and stage icons. The landing page's hardcoded demo `mini-bracket` is left as-is.
- Add a `bracket` i18n namespace (en/es/fr/de).

## Capabilities

### New Capabilities
- `playoff-bracket`: A public, results-driven knockout bracket for the active competition — projects R32 participants from live group standings (provisional → confirmed), resolves best-third slots via the official allocation once groups finish, fills later rounds from recorded knockout results, and renders the whole bracket on a dedicated `/bracket` page.

### Modified Capabilities
<!-- None. group-standings/group-simulation are reused, not changed. Knockout fixtures and the admin rename flow are unchanged; this adds a read-only projected view. -->

## Impact

- **New route**: `app/[locale]/(public)/bracket/page.tsx` (+ `loading.tsx`).
- **New lib**: `lib/bracket.ts` (server loader) + a DB-free core for slot parsing/resolution, match numbering, and best-third allocation (unit-tested). Reuses `buildGroupTables` from `lib/group-standings.ts`.
- **New data**: the FIFA 2026 best-third allocation table (static, generated into a module).
- **New component**: `components/bracket-view.tsx`.
- **Navigation**: `components/site-nav.tsx` adds a Bracket link.
- **i18n**: new `bracket` namespace in `messages/{en,es,fr,de}.json`.
- **Data source**: consumes already-synced `matches` rows (group + knockout); no new external calls, no schema changes, no new dependencies.
