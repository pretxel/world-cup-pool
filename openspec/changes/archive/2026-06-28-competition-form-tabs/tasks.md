## 1. Tab scaffold in CompetitionForm

- [x] 1.1 Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs` into `competition-form.tsx`
- [x] 1.2 Add client tab state (`useState` with default `"identity"`); define the five tab ids: identity, dates, format, providers, branding
- [x] 1.3 Wrap the five existing `FormSection` blocks in a `Tabs` with a `TabsList` of five `TabsTrigger`s; keep each section's content inside its `TabsContent`

## 2. Submit integrity (the load-bearing requirement)

- [x] 2.1 Pass `keepMounted` to every `TabsContent` so all panels stay in the DOM (Base UI unmounts inactive panels by default)
- [x] 2.2 Confirm the Identity/Dates native inputs, the root-level hidden `format_config`, and the Providers/Branding component-local hidden `providers`/`branding` inputs are all present in the DOM while a different tab is active
- [x] 2.3 Verify switching tabs does not reset Providers/Branding local state (state lives in their components, kept mounted)

## 3. Submit, validation & error placement

- [x] 3.1 Keep the `SubmitButton` (and its `disabled={!validation.success}` gate) outside the `Tabs`, below the panels, always visible
- [x] 3.2 Ensure the action status/error banner (`ActionStatus`) renders outside the tab panels and is visible from any tab
- [x] 3.3 Add a discoverable invalid indicator on the Format `TabsTrigger` when `!validation.success` (e.g. a dot + `aria-invalid`/`data-invalid`); clear it when valid

## 4. Labels, responsiveness & a11y

- [x] 4.1 Use the existing `admin.form.section*` titles as tab labels; if too long for a tab, add short tab labels to `messages/{en,es,fr,de}.json` (keep parity across locales)
- [x] 4.2 Keep each section's `FormSection` description (or equivalent) at the top of its panel for context
- [~] DEFERRED (needs authed admin render) — 4.3 Make the `TabsList` wrap or horizontally scroll on narrow viewports; verify no clipping at 390px
- [~] DEFERRED (needs authed admin render) — 4.4 Verify keyboard nav (arrow keys move tabs, visible focus) and correct tab/tabpanel roles (Base UI provides these — confirm not broken by wrapping)

## 5. Verification

- [~] DEFERRED (auth-gated admin + DB) — 5.1 Manual: on `/admin/competitions/[id]`, edit a field in each tab, submit from the Branding tab, and confirm slug/name/dates/format_config/providers/branding all persist (no dropped/reset values)
- [~] DEFERRED (auth-gated admin + DB) — 5.2 Manual: on `/admin/competitions/new`, create a competition with values entered across multiple tabs; confirm it saves correctly
- [~] DEFERRED (auth-gated admin + DB) — 5.3 Confirm the Format-tab invalid indicator appears for an invalid format (e.g. duplicate stage keys) and submit stays disabled
- [x] 5.4 Run `pnpm typecheck` and `pnpm lint`
- [x] 5.5 Run `openspec validate competition-form-tabs --strict` and confirm it passes
