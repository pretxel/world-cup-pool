## Why

The competition create/edit form (`CompetitionForm`, used by `/admin/competitions/new` and `/admin/competitions/[id]`) stacks five long sections vertically — Identity, Dates & opening, Format, Providers, Branding — in a single ~475-line scroll. The Format section alone (a dynamic, reorderable stage list plus group config) dominates the page, so an admin editing branding must scroll past the entire stage editor. Reorganizing the sections into tabs cuts the visual load to one section at a time, makes the form scannable, and matches the tabbed pattern already used in `/admin/matches` and `/admin/operations`.

## What Changes

- Present the five `CompetitionForm` sections as **tabs** (Identity · Dates · Format · Providers · Branding) using the existing `components/ui/tabs.tsx` (Base UI) primitive, replacing the stacked `FormSection` layout.
- **Preserve single-submit integrity:** all five panels SHALL stay mounted (`keepMounted`) so every field — native inputs *and* the component-local hidden JSON inputs that Providers/Branding assemble from their own state — remains in the DOM and is submitted regardless of which tab is active. (Base UI unmounts inactive panels by default, which would silently drop those fields/state.)
- Keep the **submit button, live format validation, and the action status/error banner outside the tab panels**, always visible, so the form can be submitted and errors seen from any tab.
- Flag the **Format tab** as invalid when the live `formatConfigSchema` validation fails, so the gating error is discoverable without opening that tab.
- Keep the tab strip **responsive** (wrap or horizontally scroll on narrow admin viewports) and **accessible** (Base UI roving-tabindex/ARIA, visible focus).
- No change to what the form authors, its Zod validation, the server actions, set-active flow, or the data model — this is a presentation refactor of an existing component shared by both create and edit.

## Capabilities

### New Capabilities
<!-- None. This refactors the presentation of the existing competition editor governed by the admin-competitions capability. -->

### Modified Capabilities
- `admin-competitions`: Add requirements that the structured competition editor presents its sections as a tabbed form and that tabbing preserves single-submit integrity (all sections submit together) with validation/submit controls always accessible. Existing requirements (what the editor authors, Zod validation, list/create, set-active) are unchanged.

## Impact

- **Primary code:** `components/admin/competition-form.tsx` (wrap the five sections in `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` with `keepMounted`; move submit/validation outside the panels). Possibly a small `components/admin/competition-form-tabs.tsx` client helper if tab state/labels are extracted.
- **Reused:** `components/ui/tabs.tsx`, `FormSection` (kept for in-panel title/description or folded into tab labels), `ActionStatus`, `SubmitButton`, the existing `formatConfigSchema` live validation.
- **i18n:** tab labels reuse existing `admin.form.section*` titles; may add short tab labels to `messages/{en,es,fr,de}.json`.
- **Surfaces:** `/admin/competitions/new` and `/admin/competitions/[id]` (both render `CompetitionForm`). Admin-only; no public surface.
- **No DB, no server-action, and no breaking changes.**
