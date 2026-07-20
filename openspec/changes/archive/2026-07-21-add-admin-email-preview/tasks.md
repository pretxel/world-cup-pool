# Tasks: add-admin-email-preview

## 1. Preview registry and fixtures

- [x] 1.1 Create `lib/notifications/preview-fixtures.ts` with deterministic sample data builders typed against each template's data type (minus `strings`), covering all 11 email types; include one long name and multi-row standings among fixtures
- [x] 1.2 Create a preview registry (same file or `lib/notifications/email-previews.ts`) mapping each template id → label i18n key, i18n namespace, `buildStrings`, `buildData`, and `render` function; reuse the existing `build*Strings` exports from sender modules and `buildMagicLinkEmailStrings` from the template file
- [x] 1.3 Verify the registry compiles strictly (`npx tsc --noEmit`) so fixture drift is a compile error

## 2. Previews UI in admin Operations

- [x] 2.1 Add a Log / Previews segmented control to the Emails tab in `app/[locale]/(admin)/admin/operations/`, driven by a `mode` search param with Log as default; keep existing `EmailsView` untouched for Log
- [x] 2.2 Create `email-previews-view.tsx` (server component): template selector (all 11 types) and locale selector (`en`, `es`, `fr`, `de`) driven by `template` and `emailLocale` search params, invalid values falling back to first template / `en`
- [x] 2.3 Render the selected template server-side via the registry with `getTranslations({ locale: emailLocale, namespace })`; display subject and preheader as text and HTML in a sandboxed `<iframe sandbox srcDoc>` sized responsively
- [x] 2.4 Add HTML / plain-text toggle (search param) that swaps the iframe for a `<pre>` of the `text` output

## 3. i18n

- [x] 3.1 Add `admin.operations` preview keys (mode toggle labels, template labels, locale label, HTML/text toggle) to `messages/en.json`, then mirror to `es.json`, `fr.json`, `de.json`

## 4. Verification

- [x] 4.1 Run lint, typecheck, and existing tests; confirm no send-path modules changed behavior (imports only)
- [x] 4.2 Verify: all 11 templates render in all 4 locales, iframe isolation holds, text toggle works, non-admin is blocked by the existing Operations gate, and no email log rows appear after rendering previews
  - Render matrix (11×4) verified by `tests/email-previews.test.ts` against the real message files (missing key / bad namespace throws); determinism asserted by repeated-render test; render path does no writes by construction (no Resend/log/guard imports)
  - Gate verified against the running dev server: unauthenticated `GET /en/admin/operations?view=emails&mode=previews` → 307 to `/en/sign-in`
  - In-browser eyeball (iframe look, toggle click) not performed: local Supabase is down and `.env.development.local` points at a dead stack, so no admin session is possible locally — check visually on the next preview deploy
