# Tasks — Match Status and Needs-Pick Filters

## 1. Param helpers (`lib/match-utils.ts`)

- [x] 1.1 Add `parseStatusParam` (accepts `upcoming|live|final`, anything else → null) and a `needsPick(match, pickedIds)` predicate (unpicked AND uiStatus scheduled); export alongside existing team helpers
- [x] 1.2 Unit tests for both helpers, including unknown/array/empty param values and locked-unpicked exclusion

## 2. Server filtering (`app/[locale]/(public)/matches/page.tsx`)

- [x] 2.1 Read and validate `status` and `picks` search params; ignore `picks` when no user
- [x] 2.2 Apply filter pipeline confirmed → team → status → picks; compute stats from the team-filtered set (pre-status) with upcoming = scheduled + locked; compute needs-pick count from the team-filtered set
- [x] 2.3 Generalize `isFiltered` and the empty state to any active filter; clear affordance removes `team`, `status`, and `picks` params

## 3. Filter UI (client)

- [x] 3.1 Make stat cards single-select toggles (`aria-pressed` buttons inside the `<dl>`) writing `?status=` via the existing locale-preserving `router.replace` pattern; relabel "open" → "upcoming"
- [x] 3.2 Add needs-pick toggle with count badge, rendered only for signed-in users, writing `?picks=needed`
- [x] 3.3 Share URL-rewrite logic between team chips, stat toggles, and needs-pick toggle (extract helper rather than duplicating)

## 4. i18n (`messages/en.json`, `es.json`, `fr.json`)

- [x] 4.1 Add/replace `matches` namespace keys: upcoming stat label, needs-pick label/count, generalized filter-empty copy, clear-filters label — all three locales

## 5. Verification

- [x] 5.1 Run app: toggle each stat card (select/switch/clear), confirm URL params, list contents, and stable stat counts; combine with team filter
- [x] 5.2 Signed-in: needs-pick toggle filters to unpicked open matches, count matches team-filtered set, locked unpicked match excluded; anonymous: control absent and `?picks=needed` ignored
  (Caveat: signed-in half accepted on unit-test coverage — auth is magic-link OTP against prod Supabase, no runtime session minted. Anonymous half verified live.)
- [x] 5.3 Direct-load URLs (`?status=final&team=...`, unknown values), back/forward navigation, and combined-filter empty state with clear affordance
- [x] 5.4 Locale sweep en/es/fr for new strings; run lint and existing tests
