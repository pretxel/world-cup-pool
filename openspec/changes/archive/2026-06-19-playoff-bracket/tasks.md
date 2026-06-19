## 1. Best-third allocation data

- [x] 1.1 Add `scripts/generate-third-allocation.mjs` that emits the FIFA 2026 best-third allocation table (495 = C(12,8) entries keyed by the sorted 8-letter qualifying combination → ordered group→slot assignment), sourced from the published table.
- [x] 1.2 Generate the table into a static module (e.g. `lib/bracket-third-allocation.ts`) and commit it.

## 2. Bracket resolution core (DB-free)

- [x] 2.1 Add `lib/bracket.ts` core types + `parseKnockoutSlot()` for the three placeholder shapes: `Winner Group X`, `2nd Group X`, `3rd Group X/Y/Z/…`, `Winner Match NN`, `Loser Match NN`.
- [x] 2.2 Implement `assignMatchNumbers(matches)` — number by (stage order, kickoff, id) into ranges group 1–72, R32 73–88, R16 89–96, QF 97–100, SF 101–102, third 103, final 104.
- [x] 2.3 Implement group-slot resolution: reuse `buildGroupTables` ranks; map `Winner/2nd Group X` → rank 1/2; mark each participant `provisional` until the group has played all matches; leave unresolved when the group has zero `final` results.
- [x] 2.4 Implement best-third resolution: when all groups are complete, compute the qualifying 8 thirds + ordering, look up `lib/bracket-third-allocation.ts`, and fill `3rd Group …` slots; otherwise leave as candidate placeholder.
- [x] 2.5 Implement later-round resolution: `Winner/Loser Match NN` → winner/loser of the numbered fixture when `final` with a score; else placeholder.
- [x] 2.6 Assemble a `buildBracket(matches)` returning ordered rounds (R32→final + third-place) of resolved/unresolved slots with status flags.

## 3. Server loader

- [x] 3.1 Add `getBracket()` to `lib/bracket.ts` (server-only): resolve active competition, load all its matches (group + knockout) with stage/kickoff/group_code/scores/status/teams, call `buildBracket`, return rounds + raw matches + `hasKnockout`.
- [x] 3.2 Reuse `maybeScheduleOpportunisticSync` with the loaded rows.

## 4. Tests

- [x] 4.1 Unit-test `assignMatchNumbers` — pins 73→R32-1 … 102→SF-2, 103→third, 104→final despite group/R32 date overlap.
- [x] 4.2 Unit-test group-slot resolution: provisional vs confirmed; zero-result group stays placeholder; rank 1/2 correctness.
- [x] 4.3 Unit-test later-round resolution: winner/loser from a final score; unresolved when source not final.
- [x] 4.4 Spot-check best-third allocation for a couple of known qualifying combinations; assert candidate-placeholder behavior before completion.

## 5. Bracket UI

- [x] 5.1 Add `components/bracket-view.tsx` — data-driven round columns (R32→final + third-place) with connectors, `TeamFlag`, and stage icons; horizontally scrollable on mobile; distinct styling for provisional vs confirmed vs placeholder slots.

## 6. Public page

- [x] 6.1 Create `app/[locale]/(public)/bracket/page.tsx` (server component): set locale, call `getBracket`, render `BracketView`, empty state when `hasKnockout` is false. Read the relevant Next.js guide in `node_modules/next/dist/docs/` before writing route code.
- [x] 6.2 Call `maybeScheduleOpportunisticSync` with the loaded match rows.
- [x] 6.3 Add `generateMetadata` (title/description + canonical `/bracket`, OpenGraph) consistent with `/standings`.
- [x] 6.4 Add `app/[locale]/(public)/bracket/loading.tsx` mirroring skeleton conventions.

## 7. i18n & navigation

- [x] 7.1 Add a `bracket` namespace to `messages/en.json` (page eyebrow/heading/lede, round names if not reusing stage labels, provisional/confirmed/candidate labels, empty state) and translate in `messages/{es,fr,de}.json`.
- [x] 7.2 Add `nav.bracket` (en/es/fr/de) and a Bracket link in `components/site-nav.tsx`.

## 8. Verification

- [x] 8.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix failures.
- [x] 8.2 Manually verify `/bracket` against the seeded dev DB: R32 shows provisional projections for played groups (A/B confirmed once complete, C/D provisional), candidate placeholders for `3rd …` and empty groups, later rounds as placeholders; reachable from nav; anonymous; all four locales.
