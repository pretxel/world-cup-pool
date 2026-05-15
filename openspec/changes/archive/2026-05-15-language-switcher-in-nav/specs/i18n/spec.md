## MODIFIED Requirements

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
