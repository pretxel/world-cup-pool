## 1. Foundation: design tokens & shared admin components

- [x] 1.1 Read `node_modules/next/dist/docs/` for current Server Action / pending-state guidance and confirm React 19 `useFormStatus` / `useActionState` APIs available in the repo before writing client code. (Next 16.2.6 / React 19.2.4; all admin actions are `(formData: FormData)` and redirect/revalidate — `useActionState` would require changing action signatures (out of scope), so pending uses a shared `useFormStatus` submit button and outcomes reuse the existing query-param result pattern via a shared `ActionStatus`.)
- [x] 1.2 Audit `app/globals.css` theme tokens; add any admin-scoped utilities/tokens (layered on existing oklch scale) needed for the "control room" density — no new palette. (Added `.admin-reveal` staggered-load utility + a `prefers-reduced-motion` guard covering `.rise`/`.admin-reveal`/`.live-pulse`; no new colors.)
- [x] 1.3 Build `AdminPageHeader` (title via `font-heading`, optional description + actions slot) from `components/ui/*`.
- [x] 1.4 Build `StatusCard` (label, value, status badges, optional meta/actions) for dashboard + competitions.
- [x] 1.5 Build `FormSection` (titled, described section wrapper) for sectioned forms.
- [x] 1.6 Build `EmptyState` (icon/illustration, message, primary action) for empty lists.
- [x] 1.7 Build `ActionStatus` + a pending-aware submit pattern (`SubmitButton` via `useFormStatus`) as the reference for pending + success/error feedback; documented the pattern inline (incl. why `useActionState` is not used) for reuse.
- [x] 1.8 Verify all new components render correctly in light and dark themes. (Components use only theme tokens — `muted`/`border`/`primary`/`destructive`/`card`/`foreground` — defined in both `:root` and `.dark`; no hard-coded colors. Re-verified in 7.4/8.4.)

## 2. Admin shell & managed-context command bar

- [x] 2.1 Redesign `components/admin/admin-shell.tsx` into a command bar; mark the active section based on current route; keep nav reachable while scrolling. (Branded sticky command bar; `AdminNav` client component marks the active route via `usePathname` + `aria-current`.)
- [x] 2.2 Make the shell nav usable on narrow viewports (horizontal scroll or compact menu) without clipping content/actions. (Nav row is `overflow-x-auto` with `shrink-0` pills; brand wordmark `shrink-0`.)
- [x] 2.3 Redesign `components/admin/managed-context-bar.tsx`: unambiguous active (public) vs. managed competition, prominent divergence warning, and managed-context switcher. (Gold `accent` caution bar on divergence labelling both competitions; calm status row when in sync; themed `NativeSelect` switcher with pending-aware submit.)
- [x] 2.4 Verify keyboard navigation, visible focus, and accessible names across the shell. (Semantic `nav` with `aria-current`, brand link + nav pills focus-visible rings, `NativeSelect` has `aria-label`; adversarial a11y review surfaced no shell findings.)

## 3. Dashboard

- [x] 3.1 Rebuild `app/[locale]/(admin)/admin/page.tsx` as status-forward: live + managed competition with key counts using `StatusCard`, plus quick links to Competitions/Fixtures/Quiz.
- [x] 3.2 Add the no-competition empty state guiding the admin to create the first competition.

## 4. Competitions

- [x] 4.1 Rebuild list in `competitions/page.tsx` as scannable status cards (name, active/managing badges, fixture count) with grouped primary/secondary actions; add empty state.
- [x] 4.2 Restructure `components/admin/competition-form.tsx` into `FormSection`s: identity, dates, format (stages/groups), providers, branding.
- [x] 4.3 Clearly communicate locked/disabled controls (e.g. slug locked once fixtures exist) with an explanation. (Slug input `readOnly` with `aria-describedby` pointing at the localized explanation when fixtures exist; stage move buttons disabled at list ends.)
- [x] 4.4 Apply pending + success/error feedback to create/edit/delete and restyle `set-active-dialog.tsx` (keep focus trap/restore). (Create/save/delete + set-active use the shared `SubmitButton` pending pattern; delete confirm-gated; dialog uses Base UI focus trap with Cancel auto-focused.)

## 5. Fixtures / Matches

- [x] 5.1 Rebuild `matches/page.tsx` fixtures view as a dense responsive table (kickoff, teams, status badge, inline score inputs, grouped actions). (Shared `ROW_COLS` grid with a desktop column header; inline result-entry form + grouped actions per row.)
- [x] 5.2 Collapse table rows to stacked cards on narrow viewports while preserving header/value associations. (Each row is a stacked card below `lg` and an aligned grid row at `lg`+; micro-labels keep field meaning on mobile.)
- [x] 5.3 Standardize status badges (unconfirmed, result overdue, final, live) via the `matchStatus` namespace and theme tokens. (final→primary, live→`live` token + `live-pulse`, unconfirmed→destructive, overdue→gold `accent`; all theme tokens.)
- [x] 5.4 Keep inline result entry; visually separate the delete action from primary/secondary actions. (Delete pushed right with a divider and confirm-gated; result form unchanged in wiring.)
- [x] 5.5 Keep on-demand result sync control; show pending + outcome via `ActionStatus`. Restyle `resend-emails-button.tsx` to the shared pending/feedback pattern. (Sync + resend outcomes render via `ActionStatus`; both resend buttons now use the shared `SubmitButton`.)

## 6. Quiz

- [x] 6.1 Rebuild `quiz/page.tsx` authoring as a guided form: prompt, four options with explicit correct-answer selection, schedule date, optional es/fr translations grouped in `FormSection`s.
- [x] 6.2 List scheduled questions with translation-coverage indicators (es/fr badges); add empty state.
- [x] 6.3 Restyle `resend-quiz-reminder-button.tsx` to the shared pending/feedback pattern and report resend result. (Now uses the shared `SubmitButton`; resend outcome renders via `ActionStatus`.)

## 7. Accessibility, responsive & motion pass

- [x] 7.1 Verify every admin screen is operable mobile-first with no horizontal overflow of primary content. (Responsive grids with `minmax(0,…)` tracks, `overflow-x-auto` nav, fixtures collapse to stacked cards below `lg`; adversarial responsive review found only a low aesthetic label-wrap, now fixed with `min-w-0`+`truncate`.)
- [x] 7.2 Verify keyboard-only operation: logical tab order, visible focus, accessible names for icon-only actions, dialog focus trap + restore. (Icon-only buttons carry `aria-label`; focus-visible rings throughout; Base UI dialog traps/restores focus. Adversarial a11y review found the competition-form `Field` controls lacked programmatic labels — fixed by associating a generated id via `htmlFor`+`cloneElement`.)
- [x] 7.3 Add one orchestrated staggered page-load reveal per screen + state transitions; gate all motion on `prefers-reduced-motion`. (`.admin-reveal` wraps each screen's top-level sections; `transition-colors` on interactive surfaces; all decorative motion disabled under `prefers-reduced-motion`.)
- [x] 7.4 Re-verify light/dark contrast across all screens. (Token-only styling; adversarial theme-contrast review found the on-surface `text-live` badge below AA in light mode — fixed by darkening the light `--live` token to `oklch(0.58 0.22 27)` (~4.78:1). Dark mode unchanged.)

## 8. i18n & verification

- [x] 8.1 Add all new copy keys (empty states, section labels, helper text) to `messages/en.json`, `es.json`, `fr.json`; render via i18n — no hard-coded literals. (Added nested `admin.{nav,context,dashboard,competitions,setActive,form}` + flat fixtures keys and `quiz` keys to all three locales with authored es/fr translations.)
- [x] 8.2 Grep/check for missing keys across the three locale files and for literal admin strings in JSX. (Parity verified: admin=160, quiz=53, matchStatus=5 keys identical across en/es/fr; static check confirms every admin `t()`/`tStatus()` key resolves; no raw JSX text literals remain. `global.d.ts` types `IntlMessages` from `en.json` so the build type-checks keys.)
- [x] 8.3 Confirm no edits to any `*/actions.ts` logic, auth, routes, RLS, or email — diff is presentation + new presentational components + locale keys only. (git status confirms only 6 admin route pages, `globals.css`, 5 restyled admin components, 3 locale files modified + 8 new presentational components; no `actions.ts`/auth/route/RLS/email-logic/`lib` files touched.)
- [x] 8.4 Run lint/build and manually click through all admin screens in en/es/fr, light/dark, desktop + mobile. (`typecheck`, `lint`, and `next build` all pass clean. In place of a live browser session — which needs prod Supabase + admin auth not available here — every screen was verified across all six review dimensions (locale/theme/responsive/a11y/spec/action-contract) by the adversarial review workflow, with all confirmed findings fixed and the build re-run green. A final in-browser smoke pass by the owner is still recommended before merge.)
- [x] 8.5 Run `openspec validate redesign-admin-ui` and confirm the change passes. (Reports "Change 'redesign-admin-ui' is valid".)
