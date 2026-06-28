## Context

`CompetitionForm` (`components/admin/competition-form.tsx`, `"use client"`) is a single `<form action={serverAction}>` rendering five stacked `FormSection`s:

1. **Identity** — native inputs (`name="slug"`, `name`, `short_name`, `kind`, `season`).
2. **Dates & opening** — native inputs (`tournament_start_at`, opening home/away/venue).
3. **Format** — a dynamic stage editor driven by React state (`stages`, `groupsEnabled`, …) in the `CompetitionForm` component; serialized into a single hidden `name="format_config"` input rendered at the form root, and live-validated by `formatConfigSchema` (gates the submit button).
4. **Providers** — `ProvidersFields` holds its own `useState` and emits a hidden `name="providers"` JSON input from that local state.
5. **Branding** — `BrandingFields`, same pattern: local state → hidden `name="branding"`.

The shared `Tabs` primitive (`components/ui/tabs.tsx`) wraps **Base UI** (`@base-ui/react/tabs`), already used by `admin-matches-tabs.tsx` and the operations page. The server action returns `void` (redirect-with-query-param), so errors surface via `ActionStatus` reading the URL, not field-level state.

## Goals / Non-Goals

**Goals:**
- One section visible at a time via tabs; the form scans in seconds instead of a long scroll.
- A single submit still saves **all** sections, byte-for-byte identical to today's payload.
- Validation gating and error feedback remain visible from any tab.

**Non-Goals:**
- No change to fields, Zod schema, server actions, set-active, list/create, or the DB.
- No per-field error mapping to tabs (the action returns a coarse banner message, not field errors) — beyond flagging the Format tab via the existing live `formatConfigSchema` result.
- No multi-step "wizard" semantics (no next/back gating); tabs are free navigation.

## Decisions

### D1: `keepMounted` on every panel — the load-bearing decision
Base UI `Tabs.Panel` unmounts inactive panels by default. Two sections would break under that:
- **Providers/Branding** keep their input state *inside* the section component and emit their hidden `providers`/`branding` JSON inputs from it. Unmounting resets that state **and** removes the hidden inputs from `FormData`, so submitting from another tab would write empty/stale `providers`/`branding`.
- **Identity/Dates** use native inputs; an unmounted panel removes them from `FormData` entirely.

Therefore every `TabsContent` SHALL pass `keepMounted` (Base UI keeps the panel in the DOM, hidden, when inactive). Format is technically safe (parent-owned state + root-level hidden input) but uses `keepMounted` too for consistency.
- *Alternative:* lift Providers/Branding state into `CompetitionForm` and render their hidden inputs at the form root (like `format_config`). Works, but a larger refactor than the presentation change calls for; `keepMounted` is the minimal, lowest-risk path. Documented as a future cleanup.

### D2: Submit, live validation, and error banner live outside the tabs
The `SubmitButton` (gated by `!validation.success`), the format-validation feedback, and the `ActionStatus` banner render **below the `Tabs` block**, always visible. So an admin can submit from any tab and always sees pending/error/success state. The submit must not be trapped inside a panel.

### D3: Tab state is client-side with a sensible default; Format tab shows validity
Active tab is `useState("identity")`. The **Format** `TabsTrigger` renders an error affordance (e.g. a dot/`aria-invalid`) when `!validation.success`, reusing the existing live `formatConfigSchema` result, so the one gating error is discoverable without opening Format.
- *Alternative:* URL-owned `?tab=` (like `admin-matches-tabs`) for reload/redirect survival. Rejected for v1: the success path redirects away and the error path shows a global banner, so client state + the Format-tab flag are sufficient; URL state can be added later if deep-linking a tab is wanted.

### D4: Reuse section titles as tab labels; keep description in-panel
Tab labels come from the existing `admin.form.section*` titles (short forms added to i18n if the full titles are too long for a tab). Each panel keeps its `FormSection` description line at the top for context.

## Risks / Trade-offs

- **[Dropped fields on submit]** the entire point of D1 → Mitigation: an explicit test/manual check that a submit initiated while a *non-default* tab is active still writes slug/name/dates/providers/branding/format_config. This is the acceptance gate.
- **[Hidden invalid field]** a field error on a non-visible tab could confuse → Mitigation: Format tab carries a live-validation flag (D3); other sections have no client-side field validation today, so behavior is unchanged from the stacked layout (same coarse banner).
- **[Tab overflow on mobile]** five triggers on a narrow admin viewport → Mitigation: allow the `TabsList` to wrap or scroll horizontally; verify at 390px.
- **[`keepMounted` perf]** all panels in the DOM at once → negligible; this is already the case today (all sections render stacked).

## Migration Plan

Pure component refactor. Ship `competition-form.tsx` with the tabbed layout; both `/new` and `/[id]` pick it up automatically (they render the same component). Rollback = revert the component. No data or config migration.

## Open Questions

- Tab order: keep authoring order (Identity → Branding) — assumed yes (matches mental model of setup flow).
- Short tab labels vs full section titles — decide during implementation based on width at 390px.
