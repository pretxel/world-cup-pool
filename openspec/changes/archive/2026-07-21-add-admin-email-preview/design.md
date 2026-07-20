# Design: add-admin-email-preview

## Context

Every transactional email is already split into a pure renderer (`lib/notifications/*-template.ts`, exporting `render*(data) → { subject, html, text }`) and a sender module that resolves recipients, builds localized strings via `build*Strings(t)` with `getTranslations`, and calls Resend. The renderers take plain data objects and have no I/O, which makes them directly reusable for preview. The admin Operations page (`app/[locale]/(admin)/admin/operations/page.tsx`) already has a tabbed layout (`overview | runs | emails | activity`) driven by a `?view=` search param, and the Emails tab shows send logs.

Email types to cover (11): welcome, result, results-digest, recap-digest, prediction-reminder, quiz-reminder, playoff-score, comeback, score-rules, group-invite, magic-link.

Supported locales: `en`, `es`, `fr`, `de` (`SUPPORTED_LOCALES` in `lib/i18n.ts`).

## Goals / Non-Goals

**Goals**

- Admin can see exactly what each email type renders as (subject, preheader, HTML, plain text) in any supported locale, without sending anything.
- Previews are deterministic: fixed sample data, no database reads.
- Zero risk to send paths: no guard stamps, no log rows, no Resend calls.

**Non-Goals**

- Sending test emails to a real inbox (could be a follow-up).
- Previewing with real user/match data from the database.
- Editing email copy from the admin (copy stays in `messages/*.json`).
- Push-notification preview (`web-push.ts` is out of scope).

## Decisions

### 1. Where it lives: a "Previews" sub-view inside the existing Emails tab

Add a segmented control at the top of the Emails tab: **Log** (current view, default) and **Previews**, driven by a second search param (e.g. `?view=emails&mode=previews`). Template and locale selection also live in search params (`template`, `emailLocale`), so the whole page stays a server component and previews are linkable/refreshable.

*Alternative considered*: a fifth top-level tab ("Email previews"). Rejected — the tab row is already four wide and scrolls on mobile; previews are conceptually part of the email surface, and the existing spec's tab requirements stay untouched.

*Alternative considered*: client-side rendering of templates. Rejected — `build*Strings` helpers live in `server-only` sender modules and use `getTranslations`; rendering on the server reuses them verbatim with zero refactoring.

### 2. Sample data: one fixtures module, typed against the real template inputs

New `lib/notifications/preview-fixtures.ts` exporting, per email type, a function that returns the template's exact data type (minus `strings`) using hard-coded, representative sample values (realistic team names, scores, standings, dates). A registry object maps a template id → `{ labelKey, buildData, buildStrings, render }` so the preview page is a single generic code path and adding a future email type is one registry entry.

*Alternative considered*: pulling recent real rows from the database. Rejected — non-deterministic, breaks on empty local databases, and preview then depends on RLS/service-role plumbing for no benefit.

Fixture URLs point at the production site shape via `env.siteUrl` like the real senders do; links in the preview are display-only.

### 3. HTML display: sandboxed iframe via `srcDoc`

Render the HTML string into `<iframe sandbox="" srcDoc={html} …>` — no scripts, no same-origin access, styles fully isolated from the admin page (email CSS must not leak in, Tailwind must not leak out). Fixed responsive height with the email centered, matching how a mail client shows it. Subject and preheader render as text above the frame; a toggle (search param or small client component) switches the frame to a `<pre>` of the plain-text version.

*Alternative considered*: `dangerouslySetInnerHTML` into a div. Rejected — admin page styles and email styles would collide, and it needlessly widens the XSS surface even for trusted templates.

### 4. Locale handling: render strings with `getTranslations({ locale })`

The preview's `emailLocale` param (default `en`) is passed to `getTranslations({ locale, namespace })` exactly as `sendWelcomeEmail` does with `DEFAULT_LOCALE`, so the preview exercises the same string-building path per locale. Invalid values fall back to `en` via `isLocale`.

### 5. Magic-link template special case

`buildMagicLinkEmailStrings` already lives in the template file (not a sender), and its render needs a confirmation URL — fixture uses a dummy `https://…/auth/confirm?token=preview` URL. No auth code is touched.

## Risks / Trade-offs

- [Fixture drift: a template's data type gains a field and the fixture no longer compiles] → This is the desired behavior: fixtures are typed against the template input types, so drift is a compile error, not a silently wrong preview.
- [Sample data misrepresents edge cases (long names, empty lists)] → Fixtures deliberately include one long team/user name and multi-row standings; edge-case matrix previews are out of scope.
- [Search-param-driven UI re-renders the whole page per toggle] → Acceptable: admin-only surface, server render is cheap (pure functions), and it keeps everything RSC with no client state to hydrate.
- [11 registry entries touch 11 sender modules' string builders] → Read-only imports; no sender logic changes, so blast radius is type-level only.

## Open Questions

- None blocking. "Send me a test email" button is an obvious follow-up but explicitly out of scope.
