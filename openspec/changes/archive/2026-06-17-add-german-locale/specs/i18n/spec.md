## RENAMED Requirements

- FROM: `### Requirement: Supported locales are exactly en, es, and fr`
- TO: `### Requirement: Supported locales are exactly en, es, fr, and de`

## MODIFIED Requirements

### Requirement: Supported locales are exactly en, es, fr, and de

The system SHALL support exactly four locales — `en` (English, default), `es` (Spanish), `fr` (French), `de` (German) — and SHALL reject or redirect requests for any other locale. The list of supported locales SHALL be defined in a single module imported by middleware, the sitemap, the message loader, and the language switcher.

#### Scenario: Recognized locale
- **WHEN** a visitor opens `/es/matches`
- **THEN** the page renders in Spanish with the path unchanged

#### Scenario: German locale recognized
- **WHEN** a visitor opens `/de/matches`
- **THEN** the page renders in German with the path unchanged

#### Scenario: Unknown locale segment
- **WHEN** a visitor opens `/zz/matches`
- **THEN** the response is a redirect to `/en/matches` (or the visitor's resolved locale per the detection chain)

### Requirement: Language switcher updates the cookie and the URL prefix

The system SHALL render a language switcher that lets the visitor choose one of the four supported locales. The switcher SHALL be a styled dropdown (NOT a native HTML `<select>`) and SHALL be visible and usable on both desktop and mobile viewports. Selecting a locale SHALL update the `NEXT_LOCALE` cookie and navigate to the same logical route under the new locale prefix.

#### Scenario: Switching from English to Spanish (desktop)
- **WHEN** a visitor on `/en/matches/<id>` opens the desktop dropdown and clicks the "Español" row
- **THEN** the cookie is set to `NEXT_LOCALE=es`
- **AND** the visitor lands on `/es/matches/<id>` with Spanish content

#### Scenario: Switching from English to French (mobile)
- **WHEN** a visitor on mobile opens the menu drawer and taps the "Français" row in the Language section
- **THEN** the cookie is set to `NEXT_LOCALE=fr`
- **AND** the visitor lands on the same logical route under `/fr/...`

#### Scenario: Switching from English to German (desktop)
- **WHEN** a visitor on `/en/matches/<id>` opens the desktop dropdown and clicks the "Deutsch" row
- **THEN** the cookie is set to `NEXT_LOCALE=de`
- **AND** the visitor lands on `/de/matches/<id>` with German content

#### Scenario: Desktop trigger shows the active locale's flag and code
- **WHEN** a visitor is on any `/es/...` route
- **THEN** the desktop nav's language-switcher trigger renders a flag image (from `/flags/<slug>.svg`) followed by the uppercase ISO code "ES"

#### Scenario: Native select is gone
- **WHEN** the rendered nav DOM is inspected on any locale-prefixed route
- **THEN** there is no `<select>` element used for locale switching anywhere in the document

#### Scenario: Switcher options show all four locales by flag and name
- **WHEN** the switcher dropdown is open (or the mobile Language section rendered)
- **THEN** the four option rows are labelled "English", "Español", "Français", "Deutsch"
- **AND** each row renders the associated flag image next to its name
- **AND** the row matching the active locale has a visual highlight (background tint and/or a check icon)

### Requirement: Translated content covers all user-facing surfaces in scope

The system SHALL translate the following surfaces into all four locales: home page, matches list, match detail, my-picks, leaderboard, how-it-works, admin matches page, sign-in, onboarding, error states, and empty states. Page metadata (title, description, OG title/description) SHALL also be translated.

#### Scenario: Same keys across all four locales
- **WHEN** the unit test loads `messages/en.json`, `messages/es.json`, `messages/fr.json`, `messages/de.json` and recursively flattens the keys of each
- **THEN** the four sets of keys are exactly equal

#### Scenario: No hardcoded English on a localized page
- **WHEN** a visitor opens `/de/matches`
- **THEN** every page-rendered label, button, heading, badge, and empty state is in German (team names, venues, and admin display names from the DB are explicitly excluded — they remain in their stored form)

### Requirement: Sitemap emits per-locale URLs with alternates

`app/sitemap.ts` SHALL emit one entry per (route × locale) combination. Each entry SHALL include an `alternates.languages` map naming the other three locale URLs for the same route.

#### Scenario: Four entries per route
- **WHEN** the sitemap is generated for the matches list
- **THEN** it contains entries for `/en/matches`, `/es/matches`, `/fr/matches`, and `/de/matches`
- **AND** each entry's `alternates.languages` maps the other three locales to their URLs
