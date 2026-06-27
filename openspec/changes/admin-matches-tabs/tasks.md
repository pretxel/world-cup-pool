## 1. Tab param + i18n

- [ ] 1.1 Add a `parseMatchesTab(raw, { hasKnockout, hasResultParams })` helper (in `lib/match-utils.ts` or a small util) that normalizes `?tab` to the `"fixtures" | "sync" | "reveal"` union: valid value wins; else infer `sync` when sync/confirm result params are present; else `fixtures`; downgrade `reveal` to `fixtures` when no knockout rounds.
- [ ] 1.2 Add tab labels (Fixtures / Sync / Reveal) to the `admin` namespace in `messages/en.json`, `es.json`, `fr.json` (+ `de.json` if present).

## 2. Tabs client wrapper

- [ ] 2.1 Create `components/admin/admin-matches-tabs.tsx` ("use client") wrapping shadcn `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`; props: `value`, localized labels, a `showReveal` flag, and `fixtures` / `sync` / `reveal` slot nodes (`React.ReactNode`).
- [ ] 2.2 Make it controlled — set `Tabs` `value` from the `value` prop and write `?tab=` via `useQueryParamWriter` on change (no scroll jump, preserves other params).
- [ ] 2.3 Render the Reveal trigger + panel only when `showReveal` is true; make `TabsList` full-width on `<sm` with adequate touch targets.

## 3. Wire the page

- [ ] 3.1 In `app/[locale]/(admin)/admin/matches/page.tsx`, parse the tab with the helper (passing `hasKnockout = knockoutStages.length > 0` and whether sync/confirm result params are present).
- [ ] 3.2 Keep `AdminPageHeader`, `LiveRegion`, and the page-level `fixtureDeleted` banner above the tabs; move the four section blocks into the `fixtures` / `sync` / `reveal` slots of `AdminMatchesTabs` (Fixtures = new-fixture form + fixtures list; Sync = result-sync card; Reveal = reveal card).

## 4. Action redirects

- [ ] 4.1 In `app/[locale]/(admin)/admin/matches/actions.ts`, append `tab=sync` to the `syncNow` and `confirmKnockoutTeams` redirect URLs (alongside existing result params).
- [ ] 4.2 Append `tab=fixtures` to the detail-page delete redirect that returns to `/admin/matches` with `deleteResult=deleted`.

## 5. Verify

- [ ] 5.1 Manually verify: default Fixtures tab; switching updates `?tab=` and survives reload; `?tab=bogus` and `?tab=reveal` (no knockout) fall back to Fixtures.
- [ ] 5.2 Manually verify redirect targeting: run sync and confirm-knockout land on Sync tab with their result panels; deleting a fixture returns to the Fixtures tab with the deleted notice.
- [ ] 5.3 Verify keyboard tab navigation and that live-region announcements fire from any tab; run `pnpm lint`/typecheck.
