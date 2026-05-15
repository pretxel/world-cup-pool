# i18n

## Purpose

Rules governing locale routing, detection, persistence, formatting, and the language switcher. Defines what locales the product supports (en, es, fr), how URLs carry the locale, how the system picks a locale on first visit, how every user-facing surface is translated, and how the visitor changes language via the in-app switcher.

## Requirements

### Requirement: Supported locales are exactly en, es, and fr

The system SHALL support exactly three locales — `en` (English, default), `es` (Spanish), `fr` (French) — and SHALL reject or redirect requests for any other locale. The list of supported locales SHALL be defined in a single module imported by middleware, the sitemap, the message loader, and the language switcher.

#### Scenario: Recognized locale
- **WHEN** a visitor opens `/es/matches`
- **THEN** the page renders in Spanish with the path unchanged

#### Scenario: Unknown locale segment
- **WHEN** a visitor opens `/zz/matches`
- **THEN** the response is a redirect to `/en/matches` (or the visitor's resolved locale per the detection chain)

### Requirement: Every route lives under a locale prefix

All user-facing routes SHALL exist under the `/[locale]/` segment. Bare (unprefixed) paths SHALL trigger a server-side redirect to the visitor's resolved locale.

#### Scenario: Bare root
- **WHEN** a visitor opens `/`
- **THEN** middleware redirects to `/<resolved-locale>/`

#### Scenario: Bare matches path
- **WHEN** a visitor opens `/matches`
- **THEN** middleware redirects to `/<resolved-locale>/matches`

#### Scenario: Localized routes for every existing surface
- **WHEN** a visitor opens any of `/en/`, `/en/matches`, `/en/matches/<id>`, `/en/my-picks`, `/en/leaderboard`, `/en/how-it-works`, `/en/admin/matches`, `/en/sign-in`, `/en/onboarding`
- **THEN** the route resolves with a 200 response and English content
- **AND** the same paths under `/es/` and `/fr/` resolve with Spanish and French content respectively

### Requirement: Locale detection chain

On a first visit (no cookie), the system SHALL choose a locale using this priority:
1. `NEXT_LOCALE` cookie value, if set to a supported locale.
2. The best match between the request's `Accept-Language` header and the supported locales.
3. `en` as fallback.

The resolved locale SHALL be written to a `NEXT_LOCALE` cookie (long-lived, `Path=/`, `SameSite=Lax`) on the response so subsequent visits skip the negotiation.

#### Scenario: Cookie wins
- **WHEN** a visitor with `NEXT_LOCALE=es` cookie opens `/`
- **THEN** the visitor is redirected to `/es/`

#### Scenario: Accept-Language match
- **WHEN** a visitor with no cookie and `Accept-Language: fr-FR,en;q=0.5` opens `/`
- **THEN** the visitor is redirected to `/fr/`
- **AND** the response sets `NEXT_LOCALE=fr` cookie

#### Scenario: Fallback to English
- **WHEN** a visitor has no cookie and an `Accept-Language` header that matches none of `en`, `es`, `fr`
- **THEN** the visitor is redirected to `/en/`

### Requirement: Language switcher updates the cookie and the URL prefix

The system SHALL render a language switcher that lets the visitor choose one of the three supported locales. The switcher SHALL be a styled dropdown (NOT a native HTML `<select>`) and SHALL be visible and usable on both desktop and mobile viewports. Selecting a locale SHALL update the `NEXT_LOCALE` cookie and navigate to the same logical route under the new locale prefix.

#### Scenario: Switching from English to Spanish (desktop)
- **WHEN** a visitor on `/en/matches/<id>` opens the desktop dropdown and clicks the "Español" row
- **THEN** the cookie is set to `NEXT_LOCALE=es`
- **AND** the visitor lands on `/es/matches/<id>` with Spanish content

#### Scenario: Switching from English to French (mobile)
- **WHEN** a visitor on mobile opens the menu drawer and taps the "Français" row in the Language section
- **THEN** the cookie is set to `NEXT_LOCALE=fr`
- **AND** the visitor lands on the same logical route under `/fr/...`

#### Scenario: Desktop trigger shows the active locale's flag and code
- **WHEN** a visitor is on any `/es/...` route
- **THEN** the desktop nav's language-switcher trigger renders a flag image (from `/flags/<slug>.svg`) followed by the uppercase ISO code "ES"

#### Scenario: Native select is gone
- **WHEN** the rendered nav DOM is inspected on any locale-prefixed route
- **THEN** there is no `<select>` element used for locale switching anywhere in the document

#### Scenario: Switcher options show all three locales by flag and name
- **WHEN** the switcher dropdown is open (or the mobile Language section rendered)
- **THEN** the three option rows are labelled "English", "Español", "Français"
- **AND** each row renders the associated flag image next to its name
- **AND** the row matching the active locale has a visual highlight (background tint and/or a check icon)

### Requirement: Translated content covers all user-facing surfaces in scope

The system SHALL translate the following surfaces into all three locales: home page, matches list, match detail, my-picks, leaderboard, how-it-works, admin matches page, sign-in, onboarding, error states, and empty states. Page metadata (title, description, OG title/description) SHALL also be translated.

#### Scenario: Same keys across all three locales
- **WHEN** the unit test loads `messages/en.json`, `messages/es.json`, `messages/fr.json` and recursively flattens the keys of each
- **THEN** the three sets of keys are exactly equal

#### Scenario: No hardcoded English on a localized page
- **WHEN** a visitor opens `/es/matches`
- **THEN** every page-rendered label, button, heading, badge, and empty state is in Spanish (team names, venues, and admin display names from the DB are explicitly excluded — they remain in their stored form)

### Requirement: Dates and numbers render per locale

Date and time rendering (via `<LocalTime />` and any direct `Intl.DateTimeFormat` use) SHALL use the active locale. Numeric formatting (scores, point totals) SHALL use `Intl.NumberFormat` with the active locale.

#### Scenario: Spanish date format
- **WHEN** a Spanish-locale visitor views a match kickoff timestamp
- **THEN** the date is rendered using the Spanish locale's conventions (e.g. day-month-year order, Spanish month name)

#### Scenario: French date format
- **WHEN** a French-locale visitor views a match kickoff timestamp
- **THEN** the date is rendered using the French locale's conventions

### Requirement: html lang attribute matches the active locale

The `<html lang>` attribute SHALL match the active locale code on every server-rendered page.

#### Scenario: Spanish lang attribute
- **WHEN** a visitor opens any page under `/es/...`
- **THEN** the served HTML has `<html lang="es">`

#### Scenario: French lang attribute
- **WHEN** a visitor opens any page under `/fr/...`
- **THEN** the served HTML has `<html lang="fr">`

### Requirement: Sitemap emits per-locale URLs with alternates

`app/sitemap.ts` SHALL emit one entry per (route × locale) combination. Each entry SHALL include an `alternates.languages` map naming the other two locale URLs for the same route.

#### Scenario: Three entries per route
- **WHEN** the sitemap is generated for the matches list
- **THEN** it contains entries for `/en/matches`, `/es/matches`, and `/fr/matches`
- **AND** each entry's `alternates.languages` maps the other two locales to their URLs

### Requirement: Server-side redirects preserve the active locale

Server-action redirects (e.g. from `submitPrediction`, sign-in flows) SHALL produce URLs that include the active locale prefix.

#### Scenario: Sign-in redirect after auth check
- **WHEN** an unauthenticated visitor on `/es/my-picks` is redirected by the page's auth gate
- **THEN** the redirect target is `/es/sign-in?next=/es/my-picks`, not `/sign-in?next=/my-picks`
