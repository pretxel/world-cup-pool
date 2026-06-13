## 1. Localization

- [x] 1.1 Add `matches.dayExpand` and `matches.dayCollapse` (accessible action labels) to `messages/en.json`
- [x] 1.2 Mirror the new keys in `messages/es.json` with Spanish translations
- [x] 1.3 Mirror the new keys in `messages/fr.json` with French translations

## 2. Client collapsible shell

- [x] 2.1 Create `components/match-day-section.tsx` as a `"use client"` component accepting `dayKey`, `defaultOpen`, `header` content (matchday label, date, count), `children` (server-rendered rows), and the localized expand/collapse labels
- [x] 2.2 Render the header as a full-width `<button type="button">` inside the existing sticky `<h2>`, preserving the current header layout (matchday eyebrow, divider, date, count)
- [x] 2.3 Wire disclosure semantics: `aria-expanded`, `aria-controls` pointing at the row region `id`, and `hidden` on the `<ul>`/region when collapsed
- [x] 2.4 Add a `ChevronDownIcon` affordance that rotates 180° when open, respecting `prefers-reduced-motion` for the transition
- [x] 2.5 Initialize open state from `defaultOpen`; in a `useEffect`, reconcile to `localStorage["matches:day-collapsed:<dayKey>"]` if present
- [x] 2.6 Persist toggles to localStorage (collapsed = `true`), wrapping all reads/writes in try/catch so unavailable storage falls back to `defaultOpen` without throwing

## 3. Matches page integration

- [x] 3.1 In `app/[locale]/(public)/matches/page.tsx`, compute a per-day `defaultOpen` = `false` only when every match in the day is `final`/`cancelled`, else `true`
- [x] 3.2 Refactor the `dayEntries.map(...)` `<section>` to render `MatchDaySection`, passing `dayKey`, `defaultOpen`, the header pieces, and the existing `<ul>` of `MatchRowCard` rows as `children`
- [x] 3.3 Pass the localized `dayExpand`/`dayCollapse` labels from server translations into the component
- [x] 3.4 Confirm the staggered row entrance animation and per-row `animationDelay` still apply (rows remain server-rendered)

## 4. Verification

- [x] 4.1 Verify collapse/expand toggles a single day's rows and leaves other days, filters, and ordering unchanged
- [x] 4.2 Verify persistence: collapse a day, reload, confirm it stays collapsed; confirm untoggled days keep status-derived defaults (finished → collapsed, active → expanded)
- [x] 4.3 Verify accessibility: header is keyboard-operable, `aria-expanded` updates, region is associated via `aria-controls`, accessible label is localized
- [x] 4.4 Verify sticky header offset is unchanged at 320px / mobile and ≥1024px / desktop, with no gap or overlap
- [x] 4.5 Verify graceful degradation: with storage disabled the list renders defaults without error, and rows are present in the DOM without client JS
- [x] 4.6 Run lint and typecheck; confirm no new client-bundle bloat from row components leaking into the client boundary
